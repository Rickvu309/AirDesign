import type { MarkupElement } from "./element-span.js"
import { contentTypesPart, partOf, relsOf, relsOwner } from "./package-address.js"
import { decodeUtf8 } from "./package-bytes.js"
import { cut, partBytes, replacePart, requireMarkup } from "./part-markup.js"

type NotesLink = {
  readonly part: string
  readonly target: string
  readonly valueStart: number
  readonly valueEnd: number
}

function value(element: MarkupElement, name: string): string | null {
  return element.attributes.find((item) => item.name === name)?.value ?? null
}

function notesLink(rels: Uint8Array, slide: string): NotesLink | null {
  for (const element of requireMarkup(rels).elements) {
    if (element.kind !== "Relationship" || value(element, "TargetMode") === "External") continue
    if (!(value(element, "Type") ?? "").endsWith("/notesSlide")) continue
    const target = element.attributes.find((item) => item.name === "Target")
    if (target === undefined || target.value === "") continue
    return {
      part: partOf(slide, target.value),
      target: target.value,
      valueStart: target.valueStart,
      valueEnd: target.valueEnd,
    }
  }
  return null
}

function override(types: Uint8Array, part: string): MarkupElement | null {
  const name = `/${part}`
  return (
    requireMarkup(types).elements.find(
      (element) => element.kind === "Override" && value(element, "PartName") === name,
    ) ?? null
  )
}

export function onlyNotes(parts: ReadonlyMap<string, Uint8Array>, slide: string): string | null {
  const rels = parts.get(relsOf(slide))
  const link = rels === undefined ? null : notesLink(rels, slide)
  if (link === null || !parts.has(link.part)) return null
  const own = relsOf(slide)
  const file = link.part.slice(link.part.lastIndexOf("/") + 1)
  for (const [name, bytes] of parts) {
    if (name === own || name === relsOf(link.part)) continue
    const from = relsOwner(name)
    if (from === null || !decodeUtf8(bytes).includes(file)) continue
    for (const element of requireMarkup(bytes).elements) {
      if (element.kind !== "Relationship" || value(element, "TargetMode") === "External") continue
      const target = value(element, "Target")
      if (target !== null && partOf(from, target) === link.part) return null
    }
  }
  return link.part
}

export function dropNotes(parts: Map<string, Uint8Array>, notes: string) {
  parts.delete(notes)
  parts.delete(relsOf(notes))
  const types = partBytes(parts, contentTypesPart)
  const kind = override(types, notes)
  if (kind !== null) replacePart(parts, contentTypesPart, cut(types, kind.start, kind.end))
}
