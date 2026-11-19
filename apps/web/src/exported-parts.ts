import {
  addedPictures,
  assetMedia,
  landedPatch,
  writeTextValue,
  type Register,
  type TextValue,
} from "@airdesign/document"
import { exportParts, fadedFrames, orderedParts, withMedia } from "@airdesign/pptx"
import { patchImages } from "@/patch-images"

export { newSlideElement } from "@airdesign/document"

type Parts = ReadonlyMap<string, Uint8Array>

export type PictureBytes = ReadonlyMap<string, Uint8Array>

const noPictures: PictureBytes = new Map()

export function storedText(value: TextValue): string {
  return value.length === 0 ? "" : writeTextValue(value)
}

export function slideBase(parts: Parts, register: Register, pictures: PictureBytes = noPictures): Parts {
  return register.order.length === 0 ? parts : orderedParts(parts, register, (sha256) => pictures.get(sha256))
}

export function missingPictures(register: Register, pictures: PictureBytes): readonly string[] {
  const hashes = new Set(addedPictures(register).map((media) => media.sha256))
  for (const node of register.nodes) {
    const body = register.elements[node]
    const images = body === undefined ? [] : patchImages(landedPatch(body, "text"))
    for (const image of images) {
      const media = assetMedia(image)
      if (media !== null) hashes.add(media.sha256)
    }
  }
  return [...hashes].filter((sha256) => !pictures.has(sha256))
}

export function editedParts(base: Parts, register: Register, pictures: PictureBytes = noPictures): Parts {
  const edited = exportParts(base, register, (sha256) => pictures.get(sha256))
  return pictures.size === 0 ? edited : withMedia(edited, (part) => pictures.get(part))
}

export function exportedParts(parts: Parts, register: Register, pictures: PictureBytes = noPictures): Parts {
  return fadedFrames(editedParts(slideBase(parts, register, pictures), register, pictures), register)
}
