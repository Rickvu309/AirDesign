import { slidesKept, type Register } from "@airdesign/document"
import { exportedParts, type PictureBytes } from "@/exported-parts"
import { fileSlides } from "@/slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

export function chosenParts(
  parts: Parts,
  register: Register,
  slides: readonly number[] | undefined,
  pictures?: PictureBytes,
): Parts {
  if (slides === undefined) return exportedParts(parts, register, pictures)
  return exportedParts(parts, slidesKept({ ...register, file: fileSlides(parts, register) }, slides), pictures)
}
