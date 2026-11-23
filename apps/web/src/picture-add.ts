import {
  iconTextColor,
  nextElementId,
  readSlideId,
  type Box,
  type Media,
  type Register,
  type SlideCommand,
} from "@airdesign/document"
import { freeShapeId, readSlides } from "@airdesign/pptx"
import { slideBase } from "@/editing/exported-parts"

type Parts = ReadonlyMap<string, Uint8Array>

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

export { pictureRefusal, readPicture, type PictureFile, type PictureRefusal } from "@/editing/picture-file"
