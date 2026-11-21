import type { DeckId, SlidePictures } from "@airdesign/catalog"
import type { SlideId } from "@airdesign/document"

export const picturesCap = 200_000_000

type Held = { readonly key: string; readonly data: string }

type Shots = {
  readonly revision: number
  readonly keys: ReadonlyMap<SlideId, string>
  readonly held: Map<SlideId, Held>
}

export type Shot = { readonly revision: number; readonly data: string }

function heldBytes(shots: Shots): number {
  let total = 0
  for (const each of shots.held.values()) total += each.data.length
  return total
}

function missingOf(shots: Shots): readonly SlideId[] {
  return [...shots.keys].flatMap(([slide, key]) => (shots.held.get(slide)?.key === key ? [] : [slide]))
}

export class DeckPictures {
  private readonly decks = new Map<DeckId, Shots>()
  private readonly waiting = new Map<DeckId, Set<() => void>>()
  private bytes = 0
  private readonly cap: number

  constructor(cap = picturesCap) {
    this.cap = cap
  }

  keep(deck: DeckId, revision: number, pictures: SlidePictures): readonly SlideId[] {
    const was = this.decks.get(deck)
    if (was !== undefined && was.revision > revision) return missingOf(was)
    const keys = new Map(pictures.keys.map(({ slide, key }) => [slide, key]))
    const held = new Map<SlideId, Held>()
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

  shot(deck: DeckId, slide: SlideId): Shot | undefined {
    const shots = this.decks.get(deck)
    const held = shots?.held.get(slide)
    if (shots === undefined || held === undefined || shots.keys.get(slide) !== held.key) return undefined
    this.decks.delete(deck)
    this.decks.set(deck, shots)
    return { revision: shots.revision, data: held.data }
  }

  revision(deck: DeckId): number | undefined {
    return this.decks.get(deck)?.revision
  }

  missing(deck: DeckId): readonly SlideId[] {
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
