import { landedPatch, shapeOf, type ElementId, type Register } from "@airdesign/document"
import { readSlides, shownBody, shrunkBody } from "@airdesign/pptx"
import type { MeasuredFit } from "@airdesign/render"

type Parts = ReadonlyMap<string, Uint8Array>

function typedText(register: Register, node: ElementId): string | null {
  const body = register.nodes.includes(node) ? register.elements[node] : undefined
  const value = body === undefined ? undefined : landedPatch(body, "text").text?.value
  return typeof value === "object" && typeof value.set === "string" ? value.set : null
}

export function bakeFits(parts: Parts, register: Register, fits: ReadonlyMap<ElementId, MeasuredFit>): Parts {
  const slides = readSlides(parts)
  let next = parts
  for (const [node, fit] of fits) {
    if (typedText(register, node) !== fit.written) continue
    const { slide, shape } = shapeOf(node)
    const part = slides.find((each) => each.slide === slide)?.part
    const at = part === undefined ? null : { slide, part, shape }
    if (at === null || shownBody(next, at)?.autofit.value !== "shrink") continue
    next = shrunkBody(next, at, fit)
  }
  return next
}
