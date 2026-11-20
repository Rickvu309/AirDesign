import { slideNode, type Guide } from "@airdesign/document"
import { readSlideGuides, readSlides } from "@airdesign/pptx"
import type { CanvasSlide, GuideEdit } from "@airdesign/render"
import { changeRows, type DesignDeck } from "@/design/design-change"
import { currentSlide } from "@/editor/transition-value"

type Parts = ReadonlyMap<string, Uint8Array>

const readGuides = new WeakMap<Parts, Map<number, readonly Guide[]>>()
const guided = new WeakMap<CanvasSlide, { readonly guides: readonly Guide[]; readonly slide: CanvasSlide }>()

export function shownGuides(parts: Parts, index: number): readonly Guide[] {
  const held = readGuides.get(parts) ?? new Map<number, readonly Guide[]>()
  readGuides.set(parts, held)
  const known = held.get(index)
  if (known !== undefined) return known
  const part = readSlides(parts)[index]?.part
  const guides = part === undefined ? [] : readSlideGuides(parts, part)
  held.set(index, guides)
  return guides
}

function sameGuides(one: readonly Guide[], two: readonly Guide[]): boolean {
  return (
    one.length === two.length &&
    one.every((guide, index) => guide.axis === two[index]?.axis && guide.offset === two[index]?.offset)
  )
}

export function guidedCanvas(slide: CanvasSlide, guides: readonly Guide[]): CanvasSlide {
  const held = guided.get(slide)
  if (held !== undefined && sameGuides(held.guides, guides)) return held.slide
  const next = { ...slide, guides }
  guided.set(slide, { guides, slide: next })
  return next
}

export function changeGuides(deck: DesignDeck, index: number, edit: GuideEdit) {
  const slide = currentSlide(deck.shown.displayParts.current, index)
  if (slide === null) return
  changeRows(
    deck,
    () => [{ node: slideNode(slide, "slide"), patch: { guides: { ruler: { set: edit.guides } } } }],
    edit.name,
  )
}
