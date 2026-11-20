import { markupDocument, spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { contentTypesPart, partOf, relativeTarget, relsOf } from "./package-address.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { insertAt, partBytes, requireMarkup, rootClose } from "./part-markup.js"
import { xmlAttribute } from "./shape-write.js"
import { nextShapeId } from "./shape-id.js"
import { copyNamed } from "./shape-route.js"
import { isShapeTag, shapeById } from "./shape-tree.js"

type Parts = ReadonlyMap<string, Uint8Array>

export type PastedShape = {
  readonly source: Parts
  readonly from: string
  readonly shape: string
  readonly id: number
  readonly ids: ReadonlyMap<string, number>
}

type Link = { readonly id: string; readonly type: string; readonly target: string; readonly external: boolean }

const emptyRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
const connectionEnds = new Set(["a:stCxn", "a:endCxn"])
const bakedStand = "adm:baked"

function valueOf(element: MarkupElement, name: string): string | null {
  return element.attributes.find((item) => item.name === name)?.value ?? null
}

function linksOf(parts: Parts, part: string): readonly Link[] {
  const rels = parts.get(relsOf(part))
  if (rels === undefined) return []
  return requireMarkup(rels).elements.flatMap((element) => {
    const id = valueOf(element, "Id")
    const type = valueOf(element, "Type")
    const target = valueOf(element, "Target")
    if (element.kind !== "Relationship" || id === null || type === null || target === null) return []
    return [{ id, type, target, external: valueOf(element, "TargetMode") === "External" }]
  })
}

function declarations(element: MarkupElement | undefined): ReadonlyMap<string, string> {
  const found = new Map<string, string>()
  for (const item of element?.attributes ?? [])
    if (item.name.startsWith("xmlns:")) found.set(item.name.slice("xmlns:".length), item.value)
  return found
}

function prefixOf(name: string): string | null {
  const at = name.indexOf(":")
  return at < 0 ? null : name.slice(0, at)
}

function usedPrefixes(elements: readonly MarkupElement[]): ReadonlySet<string> {
  const used = new Set<string>()
  for (const element of elements) {
    const own = prefixOf(element.kind)
    if (own !== null) used.add(own)
    for (const item of element.attributes) {
      const prefix = prefixOf(item.name)
      if (prefix !== null && prefix !== "xmlns" && prefix !== "xml") used.add(prefix)
      if (item.name === "Requires" || item.name === "mc:Ignorable")
        for (const named of item.value.split(/\s+/)) if (named !== "") used.add(named)
    }
  }
  return used
}

function declaredWithin(elements: readonly MarkupElement[]): ReadonlySet<string> {
  return new Set(elements.flatMap((element) => [...declarations(element).keys()]))
}

type Linking = {
  readonly linked: (link: Link, from: string, source: Parts) => string
  readonly write: () => void
}

function linking(next: Map<string, Uint8Array>, part: string): Linking {
  const links = [...linksOf(next, part)]
  const added: string[] = []
  let highest = Math.max(0, ...links.map((link) => Number(/^rId([0-9]{1,9})$/.exec(link.id)?.[1] ?? 0)))
  return {
    linked(link, from, source) {
      const wanted = link.external ? link.target : partOf(from, link.target)
      const same = links.find(
        (each) =>
          each.type === link.type &&
          each.external === link.external &&
          (each.external ? each.target : partOf(part, each.target)) === wanted,
      )
      if (same !== undefined) return same.id
      if (!link.external) carriedPart(next, source, wanted)
      highest += 1
      const id = `rId${String(highest)}`
      const target = link.external ? link.target : relativeTarget(part, wanted)
      links.push({ id, type: link.type, target, external: link.external })
      const mode = link.external ? ' TargetMode="External"' : ""
      added.push(`<Relationship Id="${id}" Type="${xmlAttribute(link.type)}" Target="${xmlAttribute(target)}"${mode}/>`)
      return id
    },
    write() {
      if (added.length === 0) return
      const name = relsOf(part)
      const rels = next.get(name) ?? encodeUtf8(emptyRels)
      const at = rootClose(requireMarkup(rels), "Relationships", "rels")
      next.set(name, insertAt(rels, at, encodeUtf8(added.join(""))))
    },
  }
}

function typeRow(types: Uint8Array, part: string): string | null {
  const extension = part.split(".").pop()?.toLowerCase() ?? ""
  for (const element of requireMarkup(types).elements) {
    if (element.kind === "Override" && valueOf(element, "PartName") === `/${part}`)
      return decodeUtf8(types.subarray(element.start, element.end))
    if (element.kind === "Default" && valueOf(element, "Extension")?.toLowerCase() === extension)
      return decodeUtf8(types.subarray(element.start, element.end))
  }
  return null
}

function carriedPart(next: Map<string, Uint8Array>, source: Parts, part: string) {
  if (next.has(part)) return
  const bytes = source.get(part)
  if (bytes !== undefined) next.set(part, bytes)
  const types = partBytes(next, contentTypesPart)
  if (typeRow(types, part) !== null) return
  const row = typeRow(partBytes(source, contentTypesPart), part)
  if (row === null) throw new Error("types")
  next.set(contentTypesPart, insertAt(types, rootClose(requireMarkup(types), "Types", "types"), encodeUtf8(row)))
}

type Placing = { readonly shape: string; readonly id: number; readonly ids: ReadonlyMap<string, number> }

function renumbering(piece: readonly MarkupElement[], pasted: Placing, free: number): ReadonlyMap<string, string> {
  const copies = new Map<string, string>()
  let next = Math.max(free, pasted.id + 1, ...[...pasted.ids.values()].map((each) => each + 1))
  for (const mark of piece) {
    if (mark.kind !== "p:cNvPr" || mark.id === null || copies.has(mark.id)) continue
    const given = mark.id === pasted.shape ? pasted.id : pasted.ids.get(mark.id)
    copies.set(mark.id, String(given ?? next))
    if (given === undefined) next += 1
  }
  return copies
}

function idEdit(element: MarkupElement, copy: string | undefined): ByteEdit | null {
  const id = element.attributes.find((item) => item.name === "id")
  return id === undefined || copy === undefined
    ? null
    : { start: id.valueStart, end: id.valueEnd, next: encodeUtf8(copy) }
}

type Relink = (value: string) => string | null

function placedEdits(marks: readonly MarkupElement[], copies: ReadonlyMap<string, string>, relink: Relink) {
  const edits: ByteEdit[] = []
  for (const element of marks) {
    if (element.kind === "p:cNvPr") {
      const edit = idEdit(element, element.id === null ? undefined : copies.get(element.id))
      if (edit !== null) edits.push(edit)
      continue
    }
    if (element.kind === bakedStand) {
      edits.push({ start: element.start, end: element.end, next: new Uint8Array() })
      continue
    }
    if (connectionEnds.has(element.kind)) {
      const edit = idEdit(element, copies.get(valueOf(element, "id") ?? ""))
      edits.push(edit ?? { start: element.start, end: element.end, next: new Uint8Array() })
      continue
    }
    for (const item of element.attributes) {
      if (!item.name.startsWith("r:")) continue
      const id = relink(item.value)
      if (id === null) return null
      edits.push({ start: item.valueStart, end: item.valueEnd, next: encodeUtf8(id) })
    }
  }
  return edits
}

function inserted(parts: Map<string, Uint8Array>, part: string, target: Uint8Array, piece: Uint8Array): Parts {
  const tree = requireMarkup(target).elements.find((element) => element.kind === "p:spTree")
  if (tree === undefined || tree.selfClosing || tree.closeStart < 0) throw new Error("p:spTree")
  parts.set(part, insertAt(target, tree.closeStart, piece))
  return parts
}

export function pasteShape(parts: Parts, part: string, pasted: PastedShape): Parts {
  const sourceBytes = partBytes(pasted.source, pasted.from)
  const sourceDocument = requireMarkup(sourceBytes)
  const found = shapeById(sourceDocument.elements, pasted.shape)
  const piece = new Uint8Array(sourceBytes.subarray(found.start, found.end))
  const marks = requireMarkup(piece).elements
  const target = partBytes(parts, part)
  const targetDocument = requireMarkup(target)
  const copies = renumbering(marks, pasted, nextShapeId(decodeUtf8(target)))
  const next = new Map(parts)
  const relinked = linking(next, part)
  const links = new Map(linksOf(pasted.source, pasted.from).map((link) => [link.id, link]))
  const edits = placedEdits(marks, copies, (value) => {
    const link = links.get(value)
    if (link === undefined) throw new Error("rels")
    return relinked.linked(link, pasted.from, pasted.source)
  })
  if (edits === null) throw new Error("rels")
  const root = marks.find((element) => element.parent < 0)
  if (root === undefined) throw new Error("shape")
  const sourceNames = declarations(sourceDocument.elements.find((element) => element.parent < 0))
  const targetNames = declarations(targetDocument.elements.find((element) => element.parent < 0))
  const local = declaredWithin(marks)
  const missing = [...usedPrefixes(marks)].flatMap((prefix) => {
    const uri = sourceNames.get(prefix)
    return local.has(prefix) || uri === undefined || targetNames.get(prefix) === uri ? [] : [[prefix, uri] as const]
  })
  if (missing.length > 0) {
    const named = missing.map(([prefix, uri]) => ` xmlns:${prefix}="${xmlAttribute(uri)}"`).join("")
    const at = root.start + 1 + root.kind.length
    edits.push({ start: at, end: at, next: encodeUtf8(named) })
  }
  relinked.write()
  const top = copies.get(pasted.shape)
  const placed = spliceBytes(piece, edits)
  return inserted(next, part, target, top === undefined ? placed : copyNamed(placed, top))
}

export type PastedMarkup = Placing & { readonly markup: string; readonly linked: readonly string[] }

export function pasteMarkup(parts: Parts, part: string, pasted: PastedMarkup): Parts | null {
  const piece = encodeUtf8(pasted.markup)
  const document = markupDocument(piece)
  const root = document.elements.find((element) => element.parent < 0)
  if (!document.wellFormed || root === undefined || !isShapeTag(root.kind)) return null
  const target = partBytes(parts, part)
  const copies = renumbering(document.elements, pasted, nextShapeId(decodeUtf8(target)))
  const edits = placedEdits(document.elements, copies, (value) => {
    const at = /^pasted([0-9]{1,2})$/.exec(value)?.[1]
    return at === undefined ? null : (pasted.linked[Number(at)] ?? null)
  })
  return edits === null ? null : inserted(new Map(parts), part, target, spliceBytes(piece, edits))
}
