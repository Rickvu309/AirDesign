import {
  fitNewBox,
  iconTextColor,
  iconWeights,
  limits,
  nextElementId,
  readSlideId,
  slideUndoable,
  type Box,
  type ElementId,
  type Media,
  type MediaType,
  type Register,
  type SlideCommand,
  type Undoable,
} from "@airdesign/document"
import { connect, flushMedia, keepMedia, memoryRemote } from "@airdesign/live"
import { freeShapeId, iconInk, readSlides, slideColorHex } from "@airdesign/pptx"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { takenBoxes, type SlideRoom } from "@/element-edit"
import { slideBase } from "@/exported-parts"
import { iconBytes } from "@/icon-fallback"
import { fileSlides } from "@/slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

export type PictureRefusal = "type" | "size" | "unread"

export type PictureAt = {
  readonly index: number
  readonly slide: SlideRoom
  readonly keep: (sha256: string, bytes: Uint8Array) => void
}

export type PictureFile = {
  readonly bytes: Uint8Array
  readonly type: MediaType
  readonly width: number
  readonly height: number
}

const emuPerPixel = 9525
const margin = 0.9

const signatures: readonly (readonly [MediaType, readonly number[]])[] = [
  ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/gif", [0x47, 0x49, 0x46, 0x38]],
]

export function pictureType(bytes: Uint8Array): MediaType | null {
  for (const [type, signature] of signatures) {
    if (signature.every((byte, at) => bytes[at] === byte)) return type
  }
  return null
}

export function pictureRefusal(bytes: Uint8Array): PictureRefusal | null {
  if (pictureType(bytes) === null) return "type"
  return bytes.byteLength >= limits.media ? "size" : null
}

export function placedPicture(natural: { readonly width: number; readonly height: number }, slide: SlideRoom): Box {
  const width = Math.max(1, natural.width) * emuPerPixel
  const height = Math.max(1, natural.height) * emuPerPixel
  const scale = Math.min(1, (slide.width * margin) / width, (slide.height * margin) / height)
  const cx = Math.max(1, Math.round(width * scale))
  const cy = Math.max(1, Math.round(height * scale))
  return fitNewBox(slide, takenBoxes(slide), { cx, cy })
}

export type AddedSource = { readonly media: Media } | { readonly icon: string }

export function pictureCommand(
  parts: Parts,
  register: Register,
  index: number,
  source: AddedSource,
  box: Box,
): SlideCommand | null {
  const base = slideBase(parts, register)
  const slide = readSlides(base)[index]
  const id = slide === undefined ? undefined : readSlideId(slide.slide)
  if (slide === undefined || id === undefined) return null
  const node = nextElementId(register, id, freeShapeId(base, slide.part))
  const element = { node, kind: "shape", value: null, box, grouped: false } as const
  if ("media" in source) return { slide: "element-add", id, element, media: source.media }
  const opening = {
    fills: { p0: { set: { image: true } }, source: { set: source.icon }, color: { set: iconTextColor } },
  } as const
  return { slide: "element-add", id, element: { ...element, opening } }
}

export const iconSide = 914_400

export function placedIcon(slide: SlideRoom): Box {
  return fitNewBox(slide, takenBoxes(slide), { cx: iconSide, cy: iconSide })
}

export async function readPicture(file: Blob): Promise<PictureFile | PictureRefusal> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const refusal = pictureRefusal(bytes)
  const type = pictureType(bytes)
  if (refusal !== null || type === null) return refusal ?? "type"
  try {
    const image = await createImageBitmap(new Blob([bytes], { type }))
    const size = { width: image.width, height: image.height }
    image.close()
    return { bytes, type, ...size }
  } catch {
    return "unread"
  }
}

export async function commitPicture(
  deckId: string,
  parts: Parts,
  picture: PictureFile,
  at: PictureAt,
  paint: (added: ElementId, undoable: Undoable | null) => void | Promise<void>,
): Promise<CommitOutcome> {
  const opened = await connect(memoryRemote()).openDeck(deckId)
  if (!opened.ok) return "refused"
  const register = opened.register
  const sha256 = await keepMedia(deckId, picture.bytes)
  at.keep(sha256, picture.bytes)
  const box = placedPicture(picture, at.slide)
  const edit = pictureCommand(parts, register, at.index, { media: { sha256, type: picture.type } }, box)
  if (edit === null || edit.slide !== "element-add") return "refused"
  const file = fileSlides(parts, register)
  const undoable = slideUndoable(register, file, edit)
  const kept = await connect(memoryRemote()).enqueueSlide(deckId, file, edit)
  if (!kept.ok) return "refused"
  await paint(edit.element.node, undoable)
  const outcome = await flushPending(connect, deckId)
  await flushMedia(deckId)
  return outcome
}

export async function commitIcon(
  deckId: string,
  parts: Parts,
  name: string,
  at: PictureAt,
  paint: (added: ElementId, undoable: Undoable | null) => void | Promise<void>,
): Promise<CommitOutcome> {
  const opened = await connect(memoryRemote()).openDeck(deckId)
  if (!opened.ok) return "refused"
  const register = opened.register
  const slide = readSlides(slideBase(parts, register))[at.index]
  const hex = slide === undefined ? null : slideColorHex(parts, slide.part, iconTextColor)
  const made = await iconBytes({
    name,
    weight: iconWeights.lucide,
    color: { hex: hex ?? iconInk.hex, ...iconTextColor },
  })
  if (made === null) return "refused"
  for (const [part, bytes] of made) at.keep(part, bytes)
  const edit = pictureCommand(parts, register, at.index, { icon: name }, placedIcon(at.slide))
  if (edit === null || edit.slide !== "element-add") return "refused"
  const file = fileSlides(parts, register)
  const undoable = slideUndoable(register, file, edit)
  const kept = await connect(memoryRemote()).enqueueSlide(deckId, file, edit)
  if (!kept.ok) return "refused"
  await paint(edit.element.node, undoable)
  return flushPending(connect, deckId)
}
