import { presentSlides, type Register } from "@airdesign/document"
import { fileSlideGroups } from "@airdesign/pptx"
import type { StripSection } from "@/editor/slide-sidebar"
import { fileSlides } from "@/slide-edit"

export function stripSections(
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register | null,
): readonly StripSection[] {
  const state = {
    ...register,
    file: fileSlides(parts, register ?? { file: [], order: [] }),
    order: register?.order ?? [],
  }
  const sequence = presentSlides(state).map((spot) => spot.id)
  return fileSlideGroups(state, parts).map((group) => ({
    name: group.name ?? null,
    start: sequence.indexOf(group.slides[0]),
    key: group.key,
  }))
}
