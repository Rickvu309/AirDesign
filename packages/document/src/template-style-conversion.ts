import { record } from "./plain-object.js"

export const templateStyleFormat = 68

const trait = "templateStyle"

type Loose = Record<string, unknown>

function renamedKey(raw: Loose, from: readonly string[], to: string): Loose | null {
  const named = Object.keys(raw).filter((key) => key === to || from.includes(key))
  if (named.length === 0 || (named.length === 1 && named[0] === to)) return raw
  if (named.length > 1) return null
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [from.includes(key) ? to : key, value]))
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
