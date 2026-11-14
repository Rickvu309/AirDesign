import { addedPictures, writeTextValue, type Register, type TextValue } from "@airdesign/document"
import { exportParts, orderedParts } from "@airdesign/pptx"

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
  return addedPictures(register)
    .map((media) => media.sha256)
    .filter((sha256) => !pictures.has(sha256))
}

export function editedParts(base: Parts, register: Register): Parts {
  return exportParts(base, register)
}

export function exportedParts(parts: Parts, register: Register, pictures: PictureBytes = noPictures): Parts {
  return exportParts(slideBase(parts, register, pictures), register)
}
