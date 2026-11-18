import { designBytes, designOrder } from "./design.js"
import { bytesOf } from "./limits.js"
import { record } from "./plain-object.js"

export const fillsFormat = 57

type Loose = Record<string, unknown>

function paintEdit(edit: unknown): unknown {
  const picture = record(record(edit)?.set)?.picture
  return picture === undefined ? edit : { set: { image: picture } }
}

function fillsFields(raw: unknown): Loose | null {
  const fields = record(raw)
  if (fields === null) return null
  const fills: Loose = {}
  for (const [field, edit] of Object.entries(fields)) {
    if (field === "value") fills.p0 = paintEdit(edit)
    else if (field === "alpha") fills.alpha = edit
    else return null
  }
  return fills
}

function fillsPatch(raw: unknown): unknown {
  const patch = record(raw)
  if (patch === null || !Object.hasOwn(patch, "fill")) return raw
  const fills = fillsFields(patch.fill)
  if (fills === null || Object.hasOwn(patch, "fills")) return null
  return Object.fromEntries(
    Object.entries(patch).map(([trait, fields]) => (trait === "fill" ? ["fills", fills] : [trait, fields])),
  )
}

export function fillsRow(raw: Loose): unknown {
  const patch = fillsPatch(raw.patch)
  if (patch === null) return null
  return patch === raw.patch ? raw : { ...raw, v: fillsFormat, patch }
}

function shownPaint(shown: unknown): unknown {
  return Array.isArray(shown) && shown[0] === "picture" ? ["image", ...shown.slice(1)] : shown
}

function fillsDesign(raw: unknown): unknown {
  const design = record(raw)
  if (design === null || !Object.hasOwn(design, "fill")) return raw
  const renamed = Object.fromEntries(
    Object.entries(design).map(([key, shown]) => (key === "fill" ? ["fills", shownPaint(shown)] : [key, shown])),
  )
  if (bytesOf(JSON.stringify(renamed)) <= designBytes) return renamed
  const fitted: Loose = {}
  for (const key of designOrder) {
    if (!Object.hasOwn(renamed, key)) continue
    if (bytesOf(JSON.stringify({ ...fitted, [key]: renamed[key] })) > designBytes) break
    fitted[key] = renamed[key]
  }
  return fitted
}

export function fillsElement(raw: unknown): unknown {
  const element = record(raw)
  if (element === null) return raw
  const design = fillsDesign(element.design)
  const kept = Array.isArray(element.kept) && element.kept.includes("fill") ? element.kept : null
  const opening = fillsPatch(element.opening)
  if (opening === null) return null
  if (design === element.design && kept === null && opening === element.opening) return raw
  return {
    ...element,
    ...(design === undefined ? {} : { design }),
    ...(kept === null ? {} : { kept: kept.map((key) => (key === "fill" ? "fills" : key)) }),
    ...(opening === undefined ? {} : { opening }),
  }
}

function fillsElements(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw
  const elements = raw.map(fillsElement)
  if (elements.includes(null)) return null
  return elements.every((element, at) => element === raw[at]) ? raw : elements
}

function fillsSlide(raw: unknown): unknown {
  const slide = record(raw)
  if (slide === null || slide.layout === undefined) return raw
  const layout = fillsElements(slide.layout)
  if (layout === null) return null
  return layout === slide.layout ? raw : { ...slide, layout }
}

function fillsSlides(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw
  const slides = raw.map(fillsSlide)
  if (slides.includes(null)) return null
  return slides.every((slide, at) => slide === raw[at]) ? raw : slides
}

export function fillsIndex(raw: Loose): Loose | null {
  const elements = fillsElements(raw.elements)
  const slides = fillsSlides(raw.slides)
  const held = record(raw.next)
  const next = held === null ? raw.next : fillsIndex(held)
  if (elements === null || slides === null || next === null) return null
  if (elements === raw.elements && slides === raw.slides && next === raw.next) return raw
  return { ...raw, elements, slides, ...(raw.next === undefined ? {} : { next }) }
}

export function fillsRegister(raw: Loose): unknown {
  const index = record(raw.index)
  if (index === null) return raw
  const converted = fillsIndex(index)
  return converted === null ? null : { ...raw, index: converted }
}

function holdsFills(raw: unknown): boolean {
  const element = record(raw)
  const design = record(element?.design)
  return (
    (design !== null && Object.hasOwn(design, "fills")) ||
    (Array.isArray(element?.kept) && element.kept.includes("fills")) ||
    record(element?.opening)?.fills !== undefined
  )
}

function slideHoldsFills(raw: unknown): boolean {
  const slide = record(raw)
  return Array.isArray(slide?.layout) && slide.layout.some(holdsFills)
}

export function indexHoldsFills(raw: unknown): boolean {
  const index = record(raw)
  if (index === null) return false
  return (
    (Array.isArray(index.elements) && index.elements.some(holdsFills)) ||
    (Array.isArray(index.slides) && index.slides.some(slideHoldsFills)) ||
    indexHoldsFills(index.next)
  )
}

function floorHoldsFills(raw: unknown): boolean {
  return Array.isArray(raw) && raw.some(holdsFills)
}

export function commandHoldsFills(raw: unknown): boolean {
  const command = record(raw)
  return (
    holdsFills(command?.element) ||
    floorHoldsFills(command?.floor) ||
    (Array.isArray(command?.copies) && command.copies.some((copy) => floorHoldsFills(record(copy)?.floor)))
  )
}
