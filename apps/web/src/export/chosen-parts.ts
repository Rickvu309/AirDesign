import { slidesKept, type Register } from "@airdesign/document"
import { exportedDeck, type ExportedDeck, type PictureBytes } from "@/editing/exported-parts"
import { fileSlides } from "@/editing/slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

export function chosenParts(
  parts: Parts,
  register: Register,
  slides: readonly number[] | undefined,
  pictures?: PictureBytes,
): ExportedDeck {
  if (slides === undefined) return exportedDeck(parts, register, pictures)
  return exportedDeck(parts, slidesKept({ ...register, file: fileSlides(parts, register) }, slides), pictures)
}
