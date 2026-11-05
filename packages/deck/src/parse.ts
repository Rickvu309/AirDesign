import { isId, isThemeId, isPlaceholderId, isOverlapId } from "./model.ts"
import type { Box, ChangeSet, Deck, Element, Run, Slide, Source, Support } from "./model.ts"

function record(v: unknown): v is Record<string, unknown> { return v !== null && typeof v === "object" && !Array.isArray(v) }
function finite(v: unknown): v is number { return typeof v === "number" && Number.isFinite(v) }
function nullable(v: unknown): v is string | null { return v === null || typeof v === "string" }
function source(v: unknown): v is Source {
  return record(v) && (v.kind === "created" || (v.kind === "original" && typeof v.part === "string" && typeof v.sha256 === "string" && /^[a-f0-9]{64}$/.test(v.sha256) && typeof v.objectId === "string" && Array.isArray(v.dependencies) && v.dependencies.every(p => typeof p === "string")))
}
function support(v: unknown): v is Support {
  return record(v) && (v.kind === "native" || (v.kind === "kept" && nullable(v.preview)) || (v.kind === "flagged" && typeof v.reason === "string" && nullable(v.preview)))
}
function box(v: unknown): v is Box { return record(v) && finite(v.x) && finite(v.y) && finite(v.width) && finite(v.height) && v.width >= 0 && v.height >= 0 }
function run(v: unknown): v is Run { return record(v) && typeof v.text === "string" && typeof v.bold === "boolean" && typeof v.font === "string" && finite(v.size) && v.size > 0 && typeof v.color === "string" }
export function isElement(v: unknown): v is Element {
  if (!record(v) || !(v.styleLinks === undefined || (Array.isArray(v.styleLinks) && v.styleLinks.every(key => ["font", "color", "fill"].includes(String(key))))) || !isId(v.id) || !box(v.box) || !source(v.source) || !support(v.support) || !(v.theme === null || isThemeId(v.theme)) || !(v.placeholder === null || isPlaceholderId(v.placeholder)) || !(v.overlap === null || isOverlapId(v.overlap))) return false
  switch (v.kind) {
    case "text": return Array.isArray(v.runs) && v.runs.length > 0 && v.runs.every(run)
    case "shape": return ["rectangle", "ellipse", "triangle"].includes(String(v.geometry)) && typeof v.fill === "string"
    case "group": return Array.isArray(v.children) && v.children.every(isElement)
    default: return false
  }
}
export function isSlide(v: unknown): v is Slide {
  return record(v) && isId(v.id) && Number.isSafeInteger(v.version) && Number(v.version) >= 0 && record(v.size) && finite(v.size.width) && v.size.width > 0 && finite(v.size.height) && v.size.height > 0 && Array.isArray(v.elements) && v.elements.every(isElement) && typeof v.notes === "string" && (v.theme === null || isThemeId(v.theme)) && source(v.source)
}
export function isDeck(v: unknown): v is Deck {
  return record(v) && (v.template === undefined || (record(v.template) && isId(v.template.id) && Number.isSafeInteger(v.template.version) && Number(v.template.version) > 0 && isId(v.template.family))) && isId(v.id) && Number.isSafeInteger(v.version) && Number(v.version) >= 0 && Array.isArray(v.slides) && v.slides.every(isSlide) && (v.placeholders === undefined || (Array.isArray(v.placeholders) && v.placeholders.every(isPlaceholderId))) && (v.overlaps === undefined || (Array.isArray(v.overlaps) && v.overlaps.every(isOverlapId))) && Array.isArray(v.themes) && v.themes.every(t => record(t) && isThemeId(t.id) && typeof t.font === "string" && typeof t.background === "string")
}
export function parseDeck(v: unknown): Deck {
  if (!isDeck(v)) throw new Error("Invalid canonical deck")
  return v
}
export function parseChangeSet(v: unknown): ChangeSet {
  if (!record(v) || !Array.isArray(v.changes)) throw new Error("Invalid ChangeSet")
  const changes = v.changes.map(c => {
    if (!record(c)) throw new Error("Invalid change")
    switch (c.kind) {
      case "insert": if (isId(c.parent) && Number.isSafeInteger(c.index) && Number(c.index) >= 0 && typeof c.index === "number" && (isSlide(c.value) || isElement(c.value))) return { kind: c.kind, parent: c.parent, index: c.index, value: c.value }; break
      case "set": if (isId(c.target) && (isDeck(c.value) || isSlide(c.value) || isElement(c.value))) return { kind: c.kind, target: c.target, value: c.value }; break
      case "move": if (isId(c.target) && isId(c.parent) && typeof c.index === "number" && Number.isSafeInteger(c.index) && c.index >= 0) return { kind: c.kind, target: c.target, parent: c.parent, index: c.index }; break
      case "remove": if (isId(c.target)) return { kind: c.kind, target: c.target }; break
    }
    throw new Error("Invalid change")
  })
  return { changes }
}
