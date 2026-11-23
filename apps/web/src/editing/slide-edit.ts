import { readSlideId, type Register, type SlideId } from "@airdesign/document"
import { readSlides } from "@airdesign/pptx"
export type SlideSetChange = "clone" | "remove"
export type SelectedCopy = { readonly id: SlideId; readonly index: number }

export function fileSlides(
  parts: ReadonlyMap<string, Uint8Array>,
  register: Pick<Register, "file" | "order">,
): readonly SlideId[] {
  if (register.file.length > 0) return register.file
  const ids: SlideId[] = []
  for (const slide of readSlides(parts)) {
    const id = readSlideId(slide.slide)
    if (id === undefined) return []
    ids.push(id)
  }
  return ids
}
