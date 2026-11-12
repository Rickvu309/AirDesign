import { foldSlides, type Register, type SlideId } from "@airdesign/document"
import { deckLayouts, slideLayouts } from "@airdesign/pptx"

type Parts = ReadonlyMap<string, Uint8Array>

export type LayoutChoice = { readonly part: string; readonly name: string }

const titleLayout = "title"
const contentLayout = "obj"

export function layoutOfSlide(parts: Parts, register: Pick<Register, "file" | "order">, slide: SlideId): string | null {
  const folded = foldSlides(register)
  const layouts = slideLayouts(parts)
  let at: string = slide
  for (let step = 0; step <= folded.length; step += 1) {
    const birth = folded.find((row) => row.id === at)?.birth
    if (birth === undefined) return null
    if (birth.from === "file") return layouts.get(at) ?? null
    if (birth.from === "clone") at = birth.source
    else if (birth.layoutPart !== undefined) return birth.layoutPart
    else at = birth.layout
  }
  return null
}

export function newSlideLayout(
  parts: Parts,
  register: Pick<Register, "file" | "order">,
  current: SlideId,
): string | undefined {
  const used = layoutOfSlide(parts, register, current)
  const layouts = deckLayouts(parts)
  if (used === null || layouts.find((layout) => layout.part === used)?.type !== titleLayout) return undefined
  return layouts.find((layout) => layout.type === contentLayout)?.part
}

export function layoutChoices(parts: Parts): readonly LayoutChoice[] {
  return deckLayouts(parts).map((layout, at) => ({
    part: layout.part,
    name: layout.name === "" ? `Layout ${String(at + 1)}` : layout.name,
  }))
}
