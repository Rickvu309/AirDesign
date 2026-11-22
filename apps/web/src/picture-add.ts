import {
  fitNewBox,
  iconSideOn,
  iconTextColor,
  iconWeights,
  nextElementId,
  pictureSize,
  readSlideId,
  slideUndoable,
  type Box,
  type ElementId,
  type Media,
  type Register,
  type SlideCommand,
  type Undoable,
} from "@airdesign/document"
import { connect, flushMedia, keepMedia, memoryRemote } from "@airdesign/live"
import { freeShapeId, iconInk, readSlides, slideColorHex } from "@airdesign/pptx"
import type { PictureFile } from "@/editing/picture-file"
import { flushPending, type CommitOutcome } from "@/editing/commit-edit"
import { takenBoxes, type ElementPlan, type SlideRoom } from "@/element-edit"
import { slideBase } from "@/editing/exported-parts"
import { iconBytes } from "@/icon-fallback"
import { indexedRegister } from "@/editing/indexed-register"
import { fileSlides } from "@/editing/slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

export type PictureAt = {
  readonly index: number
  readonly slide: SlideRoom
  readonly keep: (sha256: string, bytes: Uint8Array) => void
}

export function placedPicture(natural: { readonly width: number; readonly height: number }, slide: SlideRoom): Box {
  return fitNewBox(slide, takenBoxes(slide), pictureSize(natural, slide))
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

export function placedIcon(slide: SlideRoom, side: number): Box {
  return fitNewBox(slide, takenBoxes(slide), { cx: side, cy: side })
}

export async function commitPicture(
  deckId: string,
  parts: Parts,
  register: Register,
  picture: PictureFile,
  at: PictureAt,
  paint: (added: ElementId, undoable: Undoable | null) => void | Promise<void>,
): Promise<CommitOutcome> {
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

export async function iconPlan(
  parts: Parts,
  painted: () => Register | null,
  name: string,
  at: PictureAt,
): Promise<ElementPlan | null> {
  const before = painted()
  if (before === null) return null
  const slide = readSlides(slideBase(parts, before))[at.index]
  const hex = slide === undefined ? null : slideColorHex(parts, slide.part, iconTextColor)
  const made = await iconBytes({
    name,
    weight: iconWeights.lucide,
    color: { hex: hex ?? iconInk.hex, ...iconTextColor },
  })
  const register = painted()
  if (made === null || register === null) return null
  for (const [part, bytes] of made) at.keep(part, bytes)
  const side = iconSideOn(indexedRegister(parts, register).index?.elements ?? [], slide?.slide ?? "")
  const edit = pictureCommand(parts, register, at.index, { icon: name }, placedIcon(at.slide, side))
  if (edit === null || edit.slide !== "element-add") return null
  const file = fileSlides(parts, register)
  const undoable = slideUndoable(register, file, edit)
  return {
    commands: [{ command: "slide", file, edit }],
    added: edit.element.node,
    undo: () => undoable,
    partial: false,
  }
}

export { pictureRefusal, readPicture, type PictureFile, type PictureRefusal } from "@/editing/picture-file"
