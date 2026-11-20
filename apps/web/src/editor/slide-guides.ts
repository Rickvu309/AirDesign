import { slideNode, type Guide, type LayoutGuide } from "@airdesign/document"
import { readLayoutGuideList, readSlideGuides, readSlides } from "@airdesign/pptx"
import type { CanvasSlide, GuideEdit } from "@airdesign/render"
import { changeRows, type DesignDeck } from "@/design/design-change"
import { currentSlide } from "@/editor/transition-value"

type Parts = ReadonlyMap<string, Uint8Array>

type SlideGuides = { readonly guides: readonly Guide[]; readonly layoutGuides: readonly LayoutGuide[] }

export type GuidesShown = { readonly rulers: boolean; readonly layoutGuides: boolean }

const readGuides = new WeakMap<Parts, Map<number, SlideGuides>>()
const guided = new WeakMap<CanvasSlide, { readonly key: string; readonly slide: CanvasSlide }>()

export function slideGuides(parts: Parts, index: number): SlideGuides {
  const held = readGuides.get(parts) ?? new Map<number, SlideGuides>()
  readGuides.set(parts, held)
  const known = held.get(index)
  if (known !== undefined) return known
  const part = readSlides(parts)[index]?.part
  const found =
    part === undefined
      ? { guides: [], layoutGuides: [] }
      : { guides: readSlideGuides(parts, part), layoutGuides: readLayoutGuideList(parts, part) }
  held.set(index, found)
  return found
}

export function shownGuides(parts: Parts, index: number): readonly Guide[] {
  return slideGuides(parts, index).guides
}

export function guidedCanvas(slide: CanvasSlide, parts: Parts, index: number, shown: GuidesShown): CanvasSlide {
  const found = slideGuides(parts, index)
  const extra = {
    ...(shown.rulers ? { guides: found.guides } : {}),
    ...(found.layoutGuides.length === 0 ? {} : { layoutGuides: found.layoutGuides }),
    ...(shown.layoutGuides ? {} : { layoutHidden: true }),
  }
  const key = JSON.stringify(extra)
  const held = guided.get(slide)
  if (held !== undefined && held.key === key) return held.slide
  const next = { ...slide, ...extra }
  guided.set(slide, { key, slide: next })
  return next
}

export function changeLayoutGuides(deck: DesignDeck, index: number, layout: readonly LayoutGuide[]) {
  const slide = currentSlide(deck.shown.displayParts.current, index)
  if (slide === null) return
  changeRows(
    deck,
    () => [{ node: slideNode(slide, "slide"), patch: { guides: { layout: { set: layout } } } }],
    "layout-guide",
  )
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
