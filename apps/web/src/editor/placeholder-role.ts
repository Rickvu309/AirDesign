import { shapeOf, type ElementId } from "@airdesign/document"
import { paintReader, readSlides } from "@airdesign/pptx"

export function placeholderRole(parts: Parameters<typeof paintReader>[0], node: ElementId): string | undefined {
  try {
    const at = shapeOf(node)
    const part = readSlides(parts).find((slide) => slide.slide === at.slide)?.part
    if (part === undefined) return undefined
    return paintReader(parts)
      .slide(part)
      .elements.find((element) => element.shape === at.shape)?.placeholder?.type
  } catch {
    return undefined
  }
}
