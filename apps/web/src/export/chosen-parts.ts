import { slidesKept, type Register } from "@airdesign/document"
import { exportedDeck, type ExportedDeck, type PictureBytes } from "@/exported-parts"
import { fileSlides } from "@/slide-edit"

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
