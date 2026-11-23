import { type DeckIndex } from "@airdesign/document"
import { designOf } from "@airdesign/catalog"
import { indexPackage, readTraits, type DeckTraits } from "@airdesign/pptx"

function traitsOf(parts: ReadonlyMap<string, Uint8Array>): DeckTraits | null {
  try {
    return readTraits(parts)
  } catch {
    return null
  }
}

export function designedParts(
  parts: ReadonlyMap<string, Uint8Array>,
): Pick<DeckIndex, "palettes" | "templateStyles" | "sectionStarts" | "slides" | "elements"> {
  const opening = indexPackage(parts)
  const traits = traitsOf(parts)
  if (traits === null) return opening
  const elements = opening.elements.map((element) => {
    const read = traits.elements.get(element.node)
    return read === undefined ? element : { ...element, ...designOf(read) }
  })
  const slides = opening.slides.map((slide) => {
    const palette = traits.slides.get(slide.id) ?? 0
    return palette === 0 ? slide : { ...slide, palette }
  })
  return {
    templateStyles: opening.templateStyles,
    sectionStarts: opening.sectionStarts,
    ...(traits.palettes.length === 0 ? {} : { palettes: traits.palettes }),
    slides,
    elements,
  }
}
