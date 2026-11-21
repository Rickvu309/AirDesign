import {
  addedPictures,
  assetMedia,
  landedPatch,
  writeTextValue,
  type Register,
  type TextValue,
} from "@airdesign/document"
import { fadedFrames, keptExport, withMedia, writtenDeck, type KeptExport, type WrittenDeck } from "@airdesign/pptx"
import { patchImages } from "@/patch-images"

export { newSlideElement } from "@airdesign/document"

type Parts = ReadonlyMap<string, Uint8Array>

export type PictureBytes = ReadonlyMap<string, Uint8Array>

const noPictures: PictureBytes = new Map()

export function storedText(value: TextValue): string {
  return value.length === 0 ? "" : writeTextValue(value)
}

export function writtenBase(parts: Parts, register: Register, pictures: PictureBytes = noPictures): WrittenDeck {
  if (register.order.length === 0) return { parts, register, leftOut: [] }
  return writtenDeck(parts, register, (sha256) => pictures.get(sha256))
}

export function slideBase(parts: Parts, register: Register, pictures: PictureBytes = noPictures): Parts {
  return writtenBase(parts, register, pictures).parts
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

export function editedDeck(base: Parts, register: Register, pictures: PictureBytes = noPictures): KeptExport {
  const kept = keptExport(base, register, (sha256) => pictures.get(sha256))
  return pictures.size === 0 ? kept : { ...kept, parts: withMedia(kept.parts, (part) => pictures.get(part)) }
}

export function editedParts(base: Parts, register: Register, pictures: PictureBytes = noPictures): Parts {
  return editedDeck(base, register, pictures).parts
}

export type ExportedDeck = {
  readonly parts: Parts
  readonly leftOut: readonly (WrittenDeck["leftOut"][number] | KeptExport["leftOut"][number])[]
}

export function exportedDeck(parts: Parts, register: Register, pictures: PictureBytes = noPictures): ExportedDeck {
  const written = writtenBase(parts, register, pictures)
  const edited = editedDeck(written.parts, written.register, pictures)
  return { parts: fadedFrames(edited.parts, written.register), leftOut: [...written.leftOut, ...edited.leftOut] }
}

export function exportedParts(parts: Parts, register: Register, pictures: PictureBytes = noPictures): Parts {
  return exportedDeck(parts, register, pictures).parts
}
