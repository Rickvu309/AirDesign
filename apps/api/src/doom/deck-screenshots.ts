import {
  screenshotsWantedMilliseconds,
  type DeckId,
  type SlideScreenshots,
  type TabSelection,
} from "@airdesign/catalog"
import type { SlideShot } from "@airdesign/agent"
import type { NodeId } from "@airdesign/doom"

export const screenshotsCap = 200_000_000
export const leaseGrace = 5_000

export type ScreenshotKey = { readonly slide: NodeId; readonly key: string }

export type Taken = ReadonlyMap<NodeId, SlideShot>

type Held = { readonly key: string; readonly data: string }

type Shots = {
  readonly revision: number
  readonly keys: ReadonlyMap<NodeId, string>
  readonly held: Map<NodeId, Held>
  readonly fontFailures: ReadonlyMap<NodeId, SlideScreenshots["keys"][number]>
}

function heldBytes(shots: Shots): number {
  let total = 0
  for (const each of shots.held.values()) total += each.data.length
  return total
}

function missingOf(shots: Shots): readonly NodeId[] {
  return [...shots.keys].flatMap(([slide, key]) => (shots.held.get(slide)?.key === key ? [] : [slide]))
}

type OpenTab = { readonly deck: DeckId; readonly selection: TabSelection | undefined }

type Wanted = { readonly until: number; readonly slides: ReadonlySet<NodeId> }

export class DeckScreenshots {
  private readonly decks = new Map<DeckId, Shots>()
  private readonly waiting = new Map<DeckId, Set<() => void>>()
  private readonly wanting = new Map<DeckId, Wanted>()
  private readonly painters = new Map<DeckId, Set<() => void>>()
  private readonly tabs = new Map<string, Set<OpenTab>>()
  private readonly renewed = new Map<DeckId, number>()
  private bytes = 0
  private readonly cap: number
  private readonly now: () => number

  constructor(cap = screenshotsCap, now: () => number = Date.now) {
    this.cap = cap
    this.now = now
  }

  want(deck: DeckId, slides: readonly NodeId[]): void {
    const held = this.wanting.get(deck)
    const kept = held !== undefined && held.until > this.now() ? held.slides : []
    this.wanting.set(deck, { until: this.now() + screenshotsWantedMilliseconds, slides: new Set([...kept, ...slides]) })
    const woken = this.painters.get(deck) ?? new Set()
    this.painters.delete(deck)
    for (const each of woken) each()
  }

  wanted(deck: DeckId): boolean {
    const held = this.wanting.get(deck)
    return held !== undefined && held.until > this.now()
  }

  wantedAmong(deck: DeckId, slides: readonly NodeId[]): readonly NodeId[] {
    const held = this.wanting.get(deck)
    if (held === undefined || held.until <= this.now()) return []
    return slides.filter((slide) => held.slides.has(slide))
  }

  openTab(email: string): OpenTab | undefined {
    return [...(this.tabs.get(email) ?? [])].at(-1)
  }

  watchTab(email: string, tab: OpenTab, signal: AbortSignal): void {
    if (signal.aborted) return
    const tabs = this.tabs.get(email) ?? new Set()
    tabs.add(tab)
    this.tabs.set(email, tabs)
    signal.addEventListener(
      "abort",
      () => {
        tabs.delete(tab)
        if (tabs.size === 0) this.tabs.delete(email)
      },
      { once: true },
    )
  }

  leased(deck: DeckId): boolean {
    if ((this.painters.get(deck)?.size ?? 0) > 0) return true
    const renewed = this.renewed.get(deck)
    if (renewed !== undefined && this.now() - renewed < leaseGrace) return true
    this.renewed.delete(deck)
    return false
  }

  lease(deck: DeckId, signal: AbortSignal): Promise<boolean> {
    this.renewed.set(deck, this.now())
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve(false)
        return
      }
      const held = this.painters.get(deck) ?? new Set()
      const wake = () => {
        this.renewed.set(deck, this.now())
        signal.removeEventListener("abort", stop)
        resolve(true)
      }
      const stop = () => {
        this.renewed.set(deck, this.now())
        const left = this.painters.get(deck)
        left?.delete(wake)
        if (left?.size === 0) this.painters.delete(deck)
        resolve(false)
      }
      held.add(wake)
      this.painters.set(deck, held)
      signal.addEventListener("abort", stop, { once: true })
    })
  }

  async take(deck: DeckId, slides: readonly ScreenshotKey[], wait: number): Promise<Taken | "no painter"> {
    if (!this.leased(deck)) return "no painter"
    const before = slides.map(({ slide, key }) => this.fontFailure(deck, slide, key))
    this.want(
      deck,
      slides.map(({ slide }) => slide),
    )
    const current = (): Taken =>
      new Map(
        slides.flatMap(({ slide, key }, at): (readonly [NodeId, SlideShot])[] => {
          const data = this.fresh(deck, slide, key)
          if (data !== undefined) return [[slide, data]]
          const failure = this.fontFailure(deck, slide, key)
          return failure !== undefined && failure !== before[at] ? [[slide, { failure: "fonts" }]] : []
        }),
      )
    let taken = current()
    const until = AbortSignal.timeout(wait)
    while (taken.size < slides.length && !until.aborted) {
      await this.wait(deck, until)
      taken = current()
    }
    return taken
  }

  keep(deck: DeckId, revision: number, screenshots: SlideScreenshots): readonly NodeId[] {
    this.renewed.set(deck, this.now())
    const was = this.decks.get(deck)
    if (was !== undefined && was.revision > revision) return missingOf(was)
    const keys = new Map(screenshots.keys.map(({ slide, key }) => [slide, key]))
    const held = new Map<NodeId, Held>()
    for (const [slide, each] of was?.held ?? []) if (keys.get(slide) === each.key) held.set(slide, each)
    for (const { slide, key, data } of screenshots.images) held.set(slide, { key, data })
    const fontFailures = new Map(
      [...(was?.fontFailures ?? [])].filter(([slide, failure]) => keys.get(slide) === failure.key && !held.has(slide)),
    )
    for (const failure of screenshots.fontFailures ?? [])
      if (!held.has(failure.slide)) fontFailures.set(failure.slide, failure)
    const next: Shots = { revision, keys, held, fontFailures }
    if (was !== undefined) this.bytes -= heldBytes(was)
    this.decks.delete(deck)
    this.decks.set(deck, next)
    this.bytes += heldBytes(next)
    this.evict(deck)
    this.wake(deck)
    return missingOf(next)
  }

  fresh(deck: DeckId, slide: NodeId, key: string): string | undefined {
    const shots = this.decks.get(deck)
    const held = shots?.held.get(slide)
    if (shots === undefined || held === undefined || held.key !== key) return undefined
    this.decks.delete(deck)
    this.decks.set(deck, shots)
    return held.data
  }

  fontFailure(deck: DeckId, slide: NodeId, key: string): SlideScreenshots["keys"][number] | undefined {
    const failure = this.decks.get(deck)?.fontFailures.get(slide)
    return failure?.key === key ? failure : undefined
  }

  revision(deck: DeckId): number | undefined {
    return this.decks.get(deck)?.revision
  }

  missing(deck: DeckId): readonly NodeId[] {
    const shots = this.decks.get(deck)
    return shots === undefined ? [] : missingOf(shots)
  }

  wait(deck: DeckId, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve()
        return
      }
      const wake = () => {
        signal.removeEventListener("abort", stop)
        resolve()
      }
      const stop = () => {
        this.waiting.get(deck)?.delete(wake)
        resolve()
      }
      const held = this.waiting.get(deck) ?? new Set()
      held.add(wake)
      this.waiting.set(deck, held)
      signal.addEventListener("abort", stop, { once: true })
    })
  }

  private wake(deck: DeckId): void {
    const woken = this.waiting.get(deck) ?? new Set()
    this.waiting.delete(deck)
    for (const each of woken) each()
  }

  private evict(kept: DeckId): void {
    for (const [deck, shots] of this.decks) {
      if (this.bytes <= this.cap) return
      if (deck === kept) continue
      this.bytes -= heldBytes(shots)
      this.decks.delete(deck)
    }
  }
}
