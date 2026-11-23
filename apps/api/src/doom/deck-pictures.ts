import { picturesWantedMilliseconds, type DeckId, type SlidePictures } from "@airdesign/catalog"
import type { NodeId } from "@airdesign/doom"

export const picturesCap = 200_000_000

type Held = { readonly key: string; readonly data: string }

type Shots = {
  readonly revision: number
  readonly keys: ReadonlyMap<NodeId, string>
  readonly held: Map<NodeId, Held>
}

function heldBytes(shots: Shots): number {
  let total = 0
  for (const each of shots.held.values()) total += each.data.length
  return total
}

function missingOf(shots: Shots): readonly NodeId[] {
  return [...shots.keys].flatMap(([slide, key]) => (shots.held.get(slide)?.key === key ? [] : [slide]))
}

type Wanted = { readonly until: number; readonly slides: ReadonlySet<NodeId> }

export class DeckPictures {
  private readonly decks = new Map<DeckId, Shots>()
  private readonly waiting = new Map<DeckId, Set<() => void>>()
  private readonly wanting = new Map<DeckId, Wanted>()
  private readonly asking = new Map<DeckId, Set<() => void>>()
  private bytes = 0
  private readonly cap: number
  private readonly now: () => number

  constructor(cap = picturesCap, now: () => number = Date.now) {
    this.cap = cap
    this.now = now
  }

  want(deck: DeckId, slides: readonly NodeId[]): void {
    const held = this.wanting.get(deck)
    const kept = held !== undefined && held.until > this.now() ? held.slides : []
    this.wanting.set(deck, { until: this.now() + picturesWantedMilliseconds, slides: new Set([...kept, ...slides]) })
    const woken = this.asking.get(deck) ?? new Set()
    this.asking.delete(deck)
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

  asked(deck: DeckId, signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve(false)
        return
      }
      const held = this.asking.get(deck) ?? new Set()
      const wake = () => {
        signal.removeEventListener("abort", stop)
        resolve(true)
      }
      const stop = () => {
        this.asking.get(deck)?.delete(wake)
        resolve(false)
      }
      held.add(wake)
      this.asking.set(deck, held)
      signal.addEventListener("abort", stop, { once: true })
    })
  }

  keep(deck: DeckId, revision: number, pictures: SlidePictures): readonly NodeId[] {
    const was = this.decks.get(deck)
    if (was !== undefined && was.revision > revision) return missingOf(was)
    const keys = new Map(pictures.keys.map(({ slide, key }) => [slide, key]))
    const held = new Map<NodeId, Held>()
    for (const [slide, each] of was?.held ?? []) if (keys.get(slide) === each.key) held.set(slide, each)
    for (const { slide, key, data } of pictures.images) held.set(slide, { key, data })
    const next: Shots = { revision, keys, held }
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
