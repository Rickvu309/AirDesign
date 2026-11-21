import { presentSlides, readSlideId, type Register, type SlideId } from "@airdesign/document"
import type { PictureBlock } from "./call-tool.js"

export const picturesPerRead = 10

export const pictureMime = "image/jpeg"

export type ReadPictures =
  | { readonly state: "closed" }
  | { readonly state: "idle" }
  | {
      readonly state: "painted"
      readonly shots: ReadonlyMap<SlideId, { readonly revision: number; readonly data: string }>
    }

export const pictureWords = {
  closed:
    "No picture: slides are painted in the owner's open AirDesign tab, and none has this deck open. Ask the owner to open the deck, then read again.",
  idle: "Pictures are painted while your run is open: make your first edit, then read with picture again.",
  behind: (slides: readonly string[], revision: number) =>
    `No picture yet of ${slides.length === 1 ? "slide" : "slides"} ${slides.join(", ")} at revision ${String(revision)}: the open tab is still painting. Read again in a few seconds.`,
  more: (shown: number, total: number) =>
    `Pictures of the first ${String(shown)} of ${String(total)} slides. Read with slide and picture for another.`,
  slide: (position: number, id: string, revision: number) =>
    `Slide ${String(position)} (${id}) at revision ${String(revision)}:`,
} as const

export function slideIds(register: Register): readonly SlideId[] {
  return register.order.length === 0
    ? (register.index?.slides ?? []).flatMap(({ id }) => readSlideId(id) ?? [])
    : presentSlides(register).map(({ id }) => id)
}

export function wantedSlides(register: Register, slide: SlideId | undefined): readonly SlideId[] {
  return slide === undefined ? slideIds(register).slice(0, picturesPerRead) : [slide]
}

export function pictureBlocks(
  pictures: ReadPictures | undefined,
  register: Register,
  slide: SlideId | undefined,
  revision: number,
): readonly PictureBlock[] {
  if (pictures === undefined || pictures.state === "closed") return [{ type: "text", text: pictureWords.closed }]
  if (pictures.state === "idle") return [{ type: "text", text: pictureWords.idle }]
  const order = slideIds(register)
  const wanted = wantedSlides(register, slide)
  const blocks: PictureBlock[] = []
  const waiting: string[] = []
  for (const id of wanted) {
    const shot = pictures.shots.get(id)
    if (shot === undefined) {
      waiting.push(id)
      continue
    }
    blocks.push({ type: "text", text: pictureWords.slide(order.indexOf(id) + 1, id, shot.revision) })
    blocks.push({ type: "image", data: shot.data, mimeType: pictureMime })
  }
  if (waiting.length > 0) blocks.push({ type: "text", text: pictureWords.behind(waiting, revision) })
  if (slide === undefined && order.length > wanted.length)
    blocks.push({ type: "text", text: pictureWords.more(wanted.length, order.length) })
  return blocks
}
