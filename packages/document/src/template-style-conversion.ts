import { templateStyleOwned } from "./element-id.js"
import { stagedElement, stamped, type Stage } from "./fills-conversion.js"
import { record } from "./plain-object.js"

export const templateStyleFormat = 68

const trait = "templateStyle"
const aliases = ["theme", "template"]

type Loose = Record<string, unknown>

function renamedKey(raw: Loose, from: readonly string[], to: string): Loose | null {
  const named = Object.keys(raw).filter((key) => key === to || from.includes(key))
  if (named.length === 0 || (named.length === 1 && named[0] === to)) return raw
  if (named.length > 1) return null
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [from.includes(key) ? to : key, value]))
}

function templateStylePatch(raw: unknown): unknown {
  const patch = record(raw)
  return patch === null ? raw : renamedKey(patch, aliases, trait)
}

const templateStyleStage: Stage = {
  keys: {},
  patch: templateStylePatch,
  kind: (kind) => kind,
  opening: (opening) => opening,
}

export function templateStyleRow(raw: Loose): unknown {
  return stamped(raw, templateStylePatch(raw.patch), templateStyleFormat)
}

export function templateStyleElement(raw: unknown): unknown {
  return stagedElement(raw, templateStyleStage)
}

function slideOf(raw: unknown): unknown {
  const slide = record(raw)
  return slide === null ? raw : renamedKey(slide, ["template"], trait)
}

export function templateStyleIndex(raw: Loose): Loose | null {
  const index = renamedKey(raw, ["templates"], "templateStyles")
  const held: readonly unknown[] = Array.isArray(raw.slides) ? raw.slides : []
  const slides = held.map(slideOf)
  const following = record(raw.next)
  const next = following === null ? raw.next : templateStyleIndex(following)
  if (index === null || next === null || slides.includes(null)) return null
  if (index === raw && slides.every((slide, at) => slide === held[at]) && next === raw.next) return raw
  return { ...index, ...(Array.isArray(raw.slides) ? { slides } : {}), ...(raw.next === undefined ? {} : { next }) }
}

export function templateStyleRegister(raw: Loose): unknown {
  const index = record(raw.index)
  if (index === null) return raw
  const converted = templateStyleIndex(index)
  return converted === null ? null : { ...raw, index: converted }
}

export function holdsTemplateStyle(raw: unknown): boolean {
  return record(record(raw)?.opening)?.[trait] !== undefined
}

export function indexHoldsTemplateStyle(raw: unknown): boolean {
  const index = record(raw)
  if (index === null) return false
  const slides = Array.isArray(index.slides) ? index.slides : []
  return (
    index.templateStyles !== undefined ||
    slides.some((slide) => record(slide)?.templateStyle !== undefined) ||
    indexHoldsTemplateStyle(index.next)
  )
}

export function namesTemplateStyle(elements: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(elements).some(templateStyleOwned)
}
