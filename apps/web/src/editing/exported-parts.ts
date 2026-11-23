import { writeTextValue, type Register, type TextValue } from "@airdesign/document"
import { fadedFrames, keptExport, withMedia, writtenDeck, type KeptExport, type WrittenDeck } from "@airdesign/pptx"

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

export function editedDeck(base: Parts, register: Register, pictures: PictureBytes = noPictures): KeptExport {
  const kept = keptExport(base, register, (sha256) => pictures.get(sha256))
  return pictures.size === 0 ? kept : { ...kept, parts: withMedia(kept.parts, (part) => pictures.get(part)) }
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
