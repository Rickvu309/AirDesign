import type { MarkupElement } from "./element-span.js"
import { spliceBytes } from "./element-span.js"
import { contentTypesPart, partOf, relsOf } from "./package-address.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { cut, digits, insertAt, partBytes, replacePart, requireMarkup, rootClose } from "./part-markup.js"

type NotesLink = {
  readonly part: string
  readonly target: string
  readonly valueStart: number
  readonly valueEnd: number
}

export type NotesCopy = {
  readonly from: string
  readonly to: string
  readonly rels: boolean
}

const notesName = "notesSlide"

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

function folder(part: string): string {
  return part.slice(0, part.lastIndexOf("/") + 1)
}

function nextNotes(parts: ReadonlyMap<string, Uint8Array>, directory: string): number {
  let max = 0
  const prefix = `${directory}${notesName}`
  for (const name of parts.keys()) {
    if (!name.startsWith(prefix) || !name.endsWith(".xml")) continue
    const number = digits(name.slice(prefix.length, name.length - 4))
    if (number !== null && number > max) max = number
  }
  return max + 1
}

function relativeTarget(from: string, to: string): string {
  const source = folder(from)
    .split("/")
    .filter((segment) => segment !== "")
  const target = to.split("/")
  let shared = 0
  while (shared < source.length && shared < target.length - 1 && source[shared] === target[shared]) shared += 1
  return [...source.slice(shared).map(() => ".."), ...target.slice(shared)].join("/")
}

function sourceOf(rels: string): string | null {
  const marker = "_rels/"
  const at = rels.lastIndexOf(marker)
  if (at < 0 || !rels.endsWith(".rels")) return null
  return `${rels.slice(0, at)}${rels.slice(at + marker.length, rels.length - 5)}`
}

function override(types: Uint8Array, part: string): MarkupElement | null {
  const name = `/${part}`
  return (
    requireMarkup(types).elements.find(
      (element) => element.kind === "Override" && value(element, "PartName") === name,
    ) ?? null
  )
}

export function notesCopy(parts: ReadonlyMap<string, Uint8Array>, slide: string): NotesCopy | null {
  const rels = parts.get(relsOf(slide))
  const link = rels === undefined ? null : notesLink(rels, slide)
  if (link === null || !parts.has(link.part)) return null
  const directory = folder(link.part)
  return {
    from: link.part,
    to: `${directory}${notesName}${nextNotes(parts, directory)}.xml`,
    rels: parts.has(relsOf(link.part)),
  }
}

function retargetSlide(rels: Uint8Array, notes: string, from: string, to: string): Uint8Array {
  const edits = []
  for (const element of requireMarkup(rels).elements) {
    if (element.kind !== "Relationship" || value(element, "TargetMode") === "External") continue
    const target = element.attributes.find((item) => item.name === "Target")
    if (target === undefined || partOf(notes, target.value) !== from) continue
    edits.push({ start: target.valueStart, end: target.valueEnd, next: encodeUtf8(relativeTarget(notes, to)) })
  }
  return edits.length === 0 ? rels : spliceBytes(rels, edits)
}

export function cloneNotes(
  parts: Map<string, Uint8Array>,
  source: string,
  slide: string,
  rels: Uint8Array,
): Uint8Array {
  const copy = notesCopy(parts, source)
  const link = notesLink(rels, source)
  if (copy === null || link === null) return rels
  parts.set(copy.to, partBytes(parts, copy.from))
  const notesRels = parts.get(relsOf(copy.from))
  if (notesRels !== undefined) parts.set(relsOf(copy.to), retargetSlide(notesRels, copy.from, source, slide))
  const types = partBytes(parts, contentTypesPart)
  const kind = override(types, copy.from)
  const contentType = kind === null ? null : value(kind, "ContentType")
  if (contentType !== null) {
    replacePart(
      parts,
      contentTypesPart,
      insertAt(
        types,
        rootClose(requireMarkup(types), "Types", "part"),
        encodeUtf8(`<Override PartName="/${copy.to}" ContentType="${contentType}"/>`),
      ),
    )
  }
  return spliceBytes(rels, [
    { start: link.valueStart, end: link.valueEnd, next: encodeUtf8(relativeTarget(slide, copy.to)) },
  ])
}

export function onlyNotes(parts: ReadonlyMap<string, Uint8Array>, slide: string): string | null {
  const rels = parts.get(relsOf(slide))
  const link = rels === undefined ? null : notesLink(rels, slide)
  if (link === null || !parts.has(link.part)) return null
  const own = relsOf(slide)
  const file = link.part.slice(link.part.lastIndexOf("/") + 1)
  for (const [name, bytes] of parts) {
    if (name === own || name === relsOf(link.part)) continue
    const from = sourceOf(name)
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
