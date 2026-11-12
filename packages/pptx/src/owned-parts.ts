import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { contentTypesPart, partOf, relativeTarget, relsOf, relsOwner } from "./package-address.js"
import { encodeUtf8, sameBytes } from "./package-bytes.js"
import { digits, insertAt, partBytes, replacePart, requireMarkup, rootClose } from "./part-markup.js"

export type SharedOwnedPart = {
  readonly part: string
  readonly owners: readonly string[]
}

type Link = {
  readonly kind: string
  readonly part: string
  readonly valueStart: number
  readonly valueEnd: number
}

const ownedKinds = new Set([
  "notesSlide",
  "comments",
  "chart",
  "chartStyle",
  "chartColorStyle",
  "chartUserShapes",
  "themeOverride",
  "package",
  "oleObject",
  "vmlDrawing",
  "control",
  "activeXControlBinary",
  "customXml",
  "diagramData",
  "diagramLayout",
  "diagramQuickStyle",
  "diagramColors",
  "diagramDrawing",
])

function value(element: MarkupElement, name: string): string | null {
  return element.attributes.find((item) => item.name === name)?.value ?? null
}

function links(rels: Uint8Array, owner: string): readonly Link[] {
  const found: Link[] = []
  for (const element of requireMarkup(rels).elements) {
    if (element.kind !== "Relationship" || value(element, "TargetMode") === "External") continue
    const target = element.attributes.find((item) => item.name === "Target")
    if (target === undefined || target.value === "") continue
    const type = value(element, "Type") ?? ""
    found.push({
      kind: type.slice(type.lastIndexOf("/") + 1),
      part: partOf(owner, target.value),
      valueStart: target.valueStart,
      valueEnd: target.valueEnd,
    })
  }
  return found
}

function freshName(parts: ReadonlyMap<string, Uint8Array>, part: string): string {
  const slash = part.lastIndexOf("/") + 1
  const folder = part.slice(0, slash)
  const file = part.slice(slash)
  const dot = file.lastIndexOf(".")
  const extension = dot < 0 ? "" : file.slice(dot)
  const stem = (dot < 0 ? file : file.slice(0, dot)).replace(/\d+$/, "")
  const prefix = `${folder}${stem}`.toLowerCase()
  const suffix = extension.toLowerCase()
  let max = 0
  for (const name of parts.keys()) {
    const lower = name.toLowerCase()
    if (!lower.startsWith(prefix) || !lower.endsWith(suffix)) continue
    const middle = lower.slice(prefix.length, lower.length - suffix.length)
    const number = middle === "" ? 0 : digits(middle)
    if (number !== null && number > max) max = number
  }
  return `${folder}${stem}${max + 1}${extension}`
}

function overrideType(types: Uint8Array, part: string): string | null {
  const name = `/${part}`.toLowerCase()
  for (const element of requireMarkup(types).elements) {
    if (element.kind === "Override" && value(element, "PartName")?.toLowerCase() === name) {
      return value(element, "ContentType")
    }
  }
  return null
}

function typed(parts: Map<string, Uint8Array>, from: string, to: string) {
  const types = partBytes(parts, contentTypesPart)
  const type = overrideType(types, from)
  if (type === null) return
  replacePart(
    parts,
    contentTypesPart,
    insertAt(
      types,
      rootClose(requireMarkup(types), "Types", "part"),
      encodeUtf8(`<Override PartName="/${to}" ContentType="${type}"/>`),
    ),
  )
}

function copied(
  parts: Map<string, Uint8Array>,
  copies: Map<string, string>,
  root: string,
  owner: string,
  rels: Uint8Array,
): Uint8Array {
  const copy = copies.get(owner) ?? owner
  const edits: ByteEdit[] = []
  for (const link of links(rels, owner)) {
    const owned = ownedKinds.has(link.kind) && parts.has(link.part)
    const back = owner !== root && copies.has(link.part)
    if (!owned && !back) continue
    let target = copies.get(link.part)
    if (target === undefined) {
      target = freshName(parts, link.part)
      copies.set(link.part, target)
      parts.set(target, partBytes(parts, link.part))
      typed(parts, link.part, target)
      const childRels = parts.get(relsOf(link.part))
      if (childRels !== undefined) parts.set(relsOf(target), copied(parts, copies, root, link.part, childRels))
    }
    edits.push({ start: link.valueStart, end: link.valueEnd, next: encodeUtf8(relativeTarget(copy, target)) })
  }
  return edits.length === 0 ? rels : spliceBytes(rels, edits)
}

export function copyOwnedParts(
  parts: Map<string, Uint8Array>,
  source: string,
  copy: string,
  rels: Uint8Array,
): Uint8Array {
  return copied(parts, new Map([[source, copy]]), source, source, rels)
}

export function sharedOwnedParts(parts: ReadonlyMap<string, Uint8Array>): readonly SharedOwnedPart[] {
  const owners = new Map<string, Set<string>>()
  for (const [name, bytes] of parts) {
    const owner = relsOwner(name)
    if (owner === null || owner === "" || !parts.has(owner)) continue
    for (const link of links(bytes, owner)) {
      if (!ownedKinds.has(link.kind) || !parts.has(link.part)) continue
      const seen = owners.get(link.part) ?? new Set<string>()
      seen.add(owner)
      owners.set(link.part, seen)
    }
  }
  return [...owners]
    .filter(([, seen]) => seen.size > 1)
    .map(([part, seen]) => ({ part, owners: [...seen].sort() }))
    .sort((left, right) => (left.part < right.part ? -1 : 1))
}

export function newSharedOwnedParts(
  original: readonly SharedOwnedPart[],
  edited: readonly SharedOwnedPart[],
): readonly SharedOwnedPart[] {
  const key = (row: SharedOwnedPart) => `${row.part}\0${row.owners.join("\0")}`
  const already = new Set(original.map(key))
  return edited.filter((row) => !already.has(key(row)))
}

export function partCopies(
  original: ReadonlyMap<string, Uint8Array>,
  edited: ReadonlyMap<string, Uint8Array>,
): ReadonlyMap<string, string> {
  const copies = new Map<string, string>()
  for (const [name, bytes] of edited) {
    if (original.has(name)) continue
    for (const [source, before] of original) {
      if (!sameBytes(before, bytes)) continue
      copies.set(name, source)
      break
    }
  }
  return copies
}
