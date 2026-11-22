import type { SlideId } from "@airdesign/document"
import { openRuns, type Deck } from "@airdesign/engine"
import { wantedSlides, type ReadPictures } from "@airdesign/mcp"
import type { DeckPictures, Shot } from "./deck-pictures.js"

export type PictureWatch = {
  readonly pictures: Pick<DeckPictures, "shot" | "wait">
  readonly following: (deck: string) => boolean
  readonly limit: number
}

function freshShots(watch: PictureWatch, deck: Deck, wanted: readonly SlideId[]): Map<SlideId, Shot> {
  const shots = new Map<SlideId, Shot>()
  for (const slide of wanted) {
    const shot = watch.pictures.shot(deck.id, slide)
    if (shot !== undefined && shot.revision >= deck.revision) shots.set(slide, shot)
  }
  return shots
}

export async function readPictures(
  watch: PictureWatch | undefined,
  deck: Deck,
  slide: SlideId | undefined,
): Promise<ReadPictures> {
  if (watch === undefined) return { state: "closed" }
  const wanted = wantedSlides(deck.register, slide)
  let shots = freshShots(watch, deck, wanted)
  const done = () => shots.size === wanted.length
  if (!watch.following(deck.id)) return shots.size > 0 ? { state: "painted", shots } : { state: "closed" }
  if (done()) return { state: "painted", shots }
  if (openRuns(deck.register).length === 0) return shots.size > 0 ? { state: "painted", shots } : { state: "idle" }
  const until = AbortSignal.timeout(watch.limit)
  while (!done() && !until.aborted) {
    await watch.pictures.wait(deck.id, until)
    shots = freshShots(watch, deck, wanted)
  }
  return { state: "painted", shots }
}
