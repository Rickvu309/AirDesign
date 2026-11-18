import { decodedXmlText, spliceBytes, type ByteEdit, type MarkupDocument, type MarkupElement } from "./element-span.js"
import { presentationPart } from "./package-address.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { cut, insertAt, partBytes, replacePart, requireMarkup, rootClose } from "./part-markup.js"
import { sectionReferences } from "./section-check.js"
import { readSections } from "./section-read.js"
import { xmlAttribute } from "./shape-write.js"
import { orderSlide } from "./slide-list-route.js"

type Parts = ReadonlyMap<string, Uint8Array>

export type SectionPlan =
  | { readonly from: number; readonly name?: string; readonly slides: readonly string[] }
  | { readonly key: string; readonly name?: string; readonly slides: readonly string[] }

type Listed = {
  readonly document: MarkupDocument
  readonly list: MarkupElement | undefined
  readonly sections: readonly MarkupElement[]
  readonly order: readonly string[]
}

type Piece = { readonly from: number | null; readonly bytes: Uint8Array }

const sectionUri = "{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"
const sectionNamespace = "http://schemas.microsoft.com/office/powerpoint/2010/main"
const untitled = "Untitled Section"
const hashSeeds = [2166136261, 84696351, 3735928559, 2654435761]

function childrenOf(elements: readonly MarkupElement[], parent: MarkupElement, kind?: string): MarkupElement[] {
  return elements
    .filter((element) => element.parent === parent.index && (kind === undefined || element.kind === kind))
    .sort((left, right) => left.start - right.start)
}

function listed(bytes: Uint8Array): Listed {
  const document = requireMarkup(bytes)
  const lists = document.elements.filter((element) => element.kind === "p14:sectionLst")
  if (lists.length > 1) throw new Error("section")
  const list = lists[0]
  const order = document.elements
    .filter((element) => element.kind === "p:sldId" && element.id !== null)
    .sort((left, right) => left.start - right.start)
    .map((element) => element.id ?? "")
  const sections = list === undefined ? [] : childrenOf(document.elements, list, "p14:section")
  return { document, list, sections, order }
}

function attributeOf(element: MarkupElement, name: string): string | undefined {
  return element.attributes.find((item) => item.name === name)?.value
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, position) => id === right[position])
}

function idListXml(ids: readonly string[]): string {
  if (ids.length === 0) return "<p14:sldIdLst/>"
  return `<p14:sldIdLst>${ids.map((id) => `<p14:sldId id="${id}"/>`).join("")}</p14:sldIdLst>`
}

function shownName(name: string | undefined): string {
  return name === undefined || name === "" ? untitled : name
}

function hashed(text: string, seed: number): string {
  let hash = seed
  for (let at = 0; at < text.length; at += 1) hash = Math.imul(hash ^ text.charCodeAt(at), 16777619) >>> 0
  return hash.toString(16).padStart(8, "0").toUpperCase()
}

export function keyedSectionId(key: string): string {
  const hex = hashSeeds.map((seed) => hashed(key, seed)).join("")
  return `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}}`
}

function freshId(key: string, used: Set<string>): string {
  let id = keyedSectionId(key)
  for (let round = 1; used.has(id); round += 1) id = keyedSectionId(`${key}\u0000${round}`)
  used.add(id)
  return id
}

function checkedPlan(found: Listed, plan: readonly SectionPlan[]): void {
  if (
    plan.length > 0 &&
    !sameIds(
      plan.flatMap((section) => section.slides),
      found.order,
    )
  )
    throw new Error("section")
  const from = plan.flatMap((section) => ("from" in section ? [section.from] : []))
  if (new Set(from).size !== from.length || from.some((at) => found.sections[at] === undefined))
    throw new Error("section")
  const keys = plan.flatMap((section) => ("key" in section ? [section.key] : []))
  if (new Set(keys).size !== keys.length) throw new Error("section")
}

function sectionEdits(
  elements: readonly MarkupElement[],
  section: MarkupElement,
  plan: SectionPlan | null,
): ByteEdit[] {
  const edits: ByteEdit[] = []
  const slides = plan?.slides ?? []
  const list = childrenOf(elements, section, "p14:sldIdLst")[0]
  const present = list === undefined ? [] : childrenOf(elements, list, "p14:sldId").map((item) => item.id ?? "")
  if (list === undefined || !sameIds(present, slides)) {
    if (section.selfClosing || section.closeStart < 0) throw new Error("section")
    const next = encodeUtf8(idListXml(slides))
    const at = list ?? { start: section.closeStart, end: section.closeStart }
    edits.push({ start: at.start, end: at.end, next })
  }
  const name = plan?.name
  const written = section.attributes.find((item) => item.name === "name")
  if (name === undefined || (written !== undefined && decodedXmlText(written.value) === shownName(name))) return edits
  const value = xmlAttribute(shownName(name))
  if (written !== undefined) edits.push({ start: written.valueStart, end: written.valueEnd, next: encodeUtf8(value) })
  else {
    const at = section.start + "<p14:section".length
    edits.push({ start: at, end: at, next: encodeUtf8(` name="${value}"`) })
  }
  return edits
}

function sectionBytes(bytes: Uint8Array, found: Listed, at: number, plan: SectionPlan): Uint8Array {
  const section = found.sections[at]
  if (section === undefined) throw new Error("section")
  const shifted = sectionEdits(found.document.elements, section, plan).map((edit) => ({
    ...edit,
    start: edit.start - section.start,
    end: edit.end - section.start,
  }))
  return spliceBytes(bytes.slice(section.start, section.end), shifted)
}

function joined(pieces: readonly Uint8Array[], gap: Uint8Array): Uint8Array {
  const total = pieces.reduce((sum, piece) => sum + piece.length, 0) + gap.length * Math.max(pieces.length - 1, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const [index, piece] of pieces.entries()) {
    if (index > 0) {
      out.set(gap, at)
      at += gap.length
    }
    out.set(piece, at)
    at += piece.length
  }
  return out
}

function sectionGap(bytes: Uint8Array, found: Listed): Uint8Array {
  const [first, second] = found.sections
  if (first === undefined || second === undefined) return new Uint8Array()
  const gap = bytes.slice(first.end, second.start)
  return decodeUtf8(gap).trim() === "" ? gap : new Uint8Array()
}

function withoutList(bytes: Uint8Array, found: Listed): Uint8Array {
  const { list, document } = found
  if (list === undefined) return bytes
  const elements = document.elements
  const only = (parent: MarkupElement, child: MarkupElement) =>
    childrenOf(elements, parent).every((item) => item.index === child.index)
  const extension = elements[list.parent]
  if (extension?.kind !== "p:ext" || !only(extension, list)) return cut(bytes, list.start, list.end)
  const extList = elements[extension.parent]
  if (extList?.kind === "p:extLst" && only(extList, extension)) return cut(bytes, extList.start, extList.end)
  return cut(bytes, extension.start, extension.end)
}

function withList(bytes: Uint8Array, document: MarkupDocument, content: Uint8Array): Uint8Array {
  const elements = document.elements
  const root = elements.find((element) => element.kind === "p:presentation" && element.parent < 0)
  const extList = elements.find((element) => element.kind === "p:extLst" && element.parent === root?.index)
  const extension =
    extList === undefined
      ? undefined
      : childrenOf(elements, extList, "p:ext").find((element) => attributeOf(element, "uri") === sectionUri)
  const list = joined(
    [encodeUtf8(`<p14:sectionLst xmlns:p14="${sectionNamespace}">`), content, encodeUtf8("</p14:sectionLst>")],
    new Uint8Array(),
  )
  if (extension !== undefined) {
    if (extension.selfClosing || extension.closeStart < 0) throw new Error("section")
    return insertAt(bytes, extension.closeStart, list)
  }
  const ext = joined([encodeUtf8(`<p:ext uri="${sectionUri}">`), list, encodeUtf8("</p:ext>")], new Uint8Array())
  if (extList !== undefined) {
    if (extList.selfClosing) throw new Error("section")
    return insertAt(bytes, extList.openEnd, ext)
  }
  const wrapped = joined([encodeUtf8("<p:extLst>"), ext, encodeUtf8("</p:extLst>")], new Uint8Array())
  return insertAt(bytes, rootClose(document, "p:presentation", "section"), wrapped)
}

function sectionListBytes(
  bytes: Uint8Array,
  plan: readonly SectionPlan[],
  referenced: () => ReadonlySet<string>,
): Uint8Array {
  const found = listed(bytes)
  checkedPlan(found, plan)
  const elements = found.document.elements
  if (plan.length === found.sections.length && plan.every((section, at) => "from" in section && section.from === at)) {
    return spliceBytes(
      bytes,
      found.sections.flatMap((section, at) => sectionEdits(elements, section, plan[at] ?? null)),
    )
  }
  const planned = new Set(plan.flatMap((section) => ("from" in section ? [section.from] : [])))
  const ended = found.sections.flatMap((_, at) => (planned.has(at) ? [] : [at]))
  const named = ended.length === 0 ? new Set<string>() : referenced()
  const used = new Set(found.sections.flatMap((section) => attributeOf(section, "id") ?? []))
  const pieces: Piece[] = plan.map((section) =>
    "from" in section
      ? { from: section.from, bytes: sectionBytes(bytes, found, section.from, section) }
      : {
          from: null,
          bytes: encodeUtf8(
            `<p14:section name="${xmlAttribute(shownName(section.name))}" id="${freshId(section.key, used)}">${idListXml(section.slides)}</p14:section>`,
          ),
        },
  )
  for (const at of ended) {
    const section = found.sections[at]
    const id = section === undefined ? undefined : attributeOf(section, "id")
    if (id === undefined || !named.has(id)) continue
    const later = pieces.flatMap((piece) => (piece.from !== null && piece.from > at ? [piece.from] : []))
    const before = later.length === 0 ? -1 : pieces.findIndex((piece) => piece.from === Math.min(...later))
    const slides = plan.length === 0 && pieces.length === 0 ? found.order : []
    pieces.splice(before < 0 ? pieces.length : before, 0, {
      from: at,
      bytes: sectionBytes(bytes, found, at, { from: at, slides }),
    })
  }
  if (pieces.length === 0) return withoutList(bytes, found)
  const content = joined(
    pieces.map((piece) => piece.bytes),
    sectionGap(bytes, found),
  )
  const first = found.sections[0]
  const last = found.sections.at(-1)
  if (found.list === undefined) return withList(bytes, found.document, content)
  if (first === undefined || last === undefined) {
    if (found.list.selfClosing || found.list.closeStart < 0) throw new Error("section")
    return insertAt(bytes, found.list.closeStart, content)
  }
  return spliceBytes(bytes, [{ start: first.start, end: last.end, next: content }])
}

export function writeSections(parts: Parts, plan: readonly SectionPlan[]): Parts {
  const bytes = partBytes(parts, presentationPart)
  const next = sectionListBytes(bytes, plan, () => sectionReferences(parts))
  if (next === bytes) return parts
  const written = new Map(parts)
  replacePart(written, presentationPart, next)
  return written
}

function fileSections(parts: Parts): SectionPlan[] {
  return readSections(parts).map((section, from) => ({ from, slides: section.slides }))
}

function sectionAt(parts: Parts, id: string): number {
  const at = listed(partBytes(parts, presentationPart)).sections.findIndex(
    (section) => attributeOf(section, "id") === id,
  )
  if (at < 0) throw new Error("section")
  return at
}

export function addSection(parts: Parts, title: string): Parts {
  const current = fileSections(parts)
  const slides = listed(partBytes(parts, presentationPart)).order
  const added = { key: title, name: title }
  return writeSections(parts, current.length === 0 ? [{ ...added, slides }] : [...current, { ...added, slides: [] }])
}

export function removeSection(parts: Parts, section: string): Parts {
  const current = fileSections(parts)
  const at = sectionAt(parts, section)
  const gone = current[at]
  if (gone === undefined) throw new Error("section")
  const kept = current.filter((_, position) => position !== at)
  const into = at === 0 ? 0 : at - 1
  const host = kept[into]
  if (host === undefined) return writeSections(parts, kept)
  const slides = at === 0 ? [...gone.slides, ...host.slides] : [...host.slides, ...gone.slides]
  return writeSections(
    parts,
    kept.map((item, position) => (position === into ? { ...item, slides } : item)),
  )
}

export function orderSection(parts: Parts, section: string, before: string): Parts {
  const current = fileSections(parts)
  const moving = sectionAt(parts, section)
  const target = sectionAt(parts, before)
  const moved = current[moving]
  if (moving === target || moved === undefined) throw new Error("section")
  const next = current.filter((_, position) => position !== moving)
  const place = next.findIndex((item) => "from" in item && item.from === target)
  next.splice(place, 0, moved)
  let bytes = partBytes(parts, presentationPart)
  for (const [index, slide] of next.flatMap((item) => item.slides).entries()) {
    const there = listed(bytes).order[index]
    if (there !== undefined && there !== slide) bytes = orderSlide(bytes, slide, there)
  }
  const reordered = new Map(parts)
  replacePart(reordered, presentationPart, bytes)
  return writeSections(reordered, next)
}
