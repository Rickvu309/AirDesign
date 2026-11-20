import {
  levelNumbering,
  listIndent,
  spacingNames,
  type ListIndent,
  type ParagraphAlign,
  type TextList,
  type TextParagraph,
} from "@airdesign/document"
import { markupDocument, spliceBytes, type MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"

const alignValue: Readonly<Record<ParagraphAlign, string>> = { left: "l", center: "ctr", right: "r" }
const bulletKinds = new Set(["a:buNone", "a:buAutoNum", "a:buChar", "a:buBlip"])
const order = [
  "a:lnSpc",
  "a:spcBef",
  "a:spcAft",
  "a:buClrTx",
  "a:buClr",
  "a:buSzTx",
  "a:buSzPct",
  "a:buSzPts",
  "a:buFontTx",
  "a:buFont",
  "a:buNone",
  "a:buAutoNum",
  "a:buChar",
  "a:buBlip",
  "a:tabLst",
  "a:defRPr",
  "a:extLst",
]
const emptyBytes = new Uint8Array(0)
const spacingXml: Readonly<Record<(typeof spacingNames)[number], (value: number) => string>> = {
  lineHeight: (value) => `<a:lnSpc><a:spcPct val="${value}"/></a:lnSpc>`,
  lineHeightPoints: (value) => `<a:lnSpc><a:spcPts val="${value}"/></a:lnSpc>`,
  spaceBefore: (value) => `<a:spcBef><a:spcPts val="${value}"/></a:spcBef>`,
  spaceAfter: (value) => `<a:spcAft><a:spcPts val="${value}"/></a:spcAft>`,
}
const spacingTags: Readonly<Record<(typeof spacingNames)[number], string>> = {
  lineHeight: "a:lnSpc",
  lineHeightPoints: "a:lnSpc",
  spaceBefore: "a:spcBef",
  spaceAfter: "a:spcAft",
}

function joinBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const merged = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0))
  let at = 0
  for (const chunk of chunks) {
    merged.set(chunk, at)
    at += chunk.length
  }
  return merged
}

function rootOf(
  slice: Uint8Array,
): { readonly root: MarkupElement; readonly children: readonly MarkupElement[] } | null {
  const document = markupDocument(slice)
  const root = document.elements.find((element) => element.parent < 0)
  if (root === undefined) return null
  return { root, children: document.elements.filter((element) => element.parent === root.index) }
}

function spacings(paragraph: TextParagraph): string {
  return spacingNames
    .map((name) => {
      const value = paragraph[name]
      return value === undefined ? "" : spacingXml[name](value)
    })
    .join("")
}

export type TemplateIndent = (level: number) => ListIndent | null

export const noTemplate: TemplateIndent = () => null

function levelAttributes(
  level: number,
  list: TextList,
  template: TemplateIndent,
): readonly (readonly [string, string | null])[] {
  const lvl = level === 0 ? null : String(level)
  if (template(level) !== null)
    return [
      ["marL", null],
      ["lvl", lvl],
      ["indent", null],
    ]
  const { marginLeft, indent } = listIndent(level, list)
  return [
    ["marL", String(marginLeft)],
    ["lvl", lvl],
    ["indent", String(indent)],
  ]
}

const listed = (list: TextList | undefined) => list === "bullets" || list === "numbers"

function created(paragraph: TextParagraph, template: TemplateIndent): Uint8Array {
  const level =
    paragraph.level === undefined && !listed(paragraph.list)
      ? ""
      : levelAttributes(paragraph.level ?? 0, paragraph.list ?? "none", template)
          .flatMap(([name, value]) => (value === null ? [] : [` ${name}="${value}"`]))
          .join("")
  const align = paragraph.align === undefined ? "" : ` algn="${alignValue[paragraph.align]}"`
  const bullet = paragraph.list === undefined ? "" : listXml(paragraph.list, paragraph.level)
  const inner = spacings(paragraph) + bullet
  return encodeUtf8(inner === "" ? `<a:pPr${level}${align}/>` : `<a:pPr${level}${align}>${inner}</a:pPr>`)
}

const isSpace = (byte: number | undefined) => byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d

function attributeBytes(slice: Uint8Array, name: string, value: string | null): Uint8Array {
  const found = rootOf(slice)
  if (found === null) return slice
  const { root } = found
  const attribute = root.attributes.find((item) => item.name === name)
  if (attribute?.value === value) return slice
  if (attribute !== undefined && value !== null) {
    return spliceBytes(slice, [{ start: attribute.valueStart, end: attribute.valueEnd, next: encodeUtf8(value) }])
  }
  if (attribute !== undefined) {
    let start = attribute.valueStart - 1
    while (start > 0 && (slice[start - 1] === 0x3d || isSpace(slice[start - 1]))) start -= 1
    start -= attribute.name.length
    while (start > 0 && isSpace(slice[start - 1])) start -= 1
    return spliceBytes(slice, [{ start, end: attribute.valueEnd + 1, next: emptyBytes }])
  }
  if (value === null) return slice
  const nameEnd = root.start + 1 + root.kind.length
  const at = root.attributes.reduce((last, item) => Math.max(last, item.valueEnd + 1), nameEnd)
  return spliceBytes(slice, [{ start: at, end: at, next: encodeUtf8(` ${name}="${value}"`) }])
}

function alignBytes(slice: Uint8Array, align: ParagraphAlign): Uint8Array {
  return attributeBytes(slice, "algn", alignValue[align])
}

function heldList(slice: Uint8Array): TextList {
  const kinds = rootOf(slice)?.children.map((child) => child.kind) ?? []
  if (kinds.includes("a:buAutoNum")) return "numbers"
  return kinds.includes("a:buNone") ? "none" : "bullets"
}

function heldLevel(slice: Uint8Array): number {
  const value = rootOf(slice)?.root.attributes.find((item) => item.name === "lvl")?.value
  const level = value === undefined ? 0 : Number(value)
  return Number.isInteger(level) && level >= 0 ? level : 0
}

function levelBytes(
  slice: Uint8Array,
  level: number,
  list: TextList | undefined,
  template: TemplateIndent,
): Uint8Array {
  const held = list ?? heldList(slice)
  let next = slice
  for (const [name, value] of levelAttributes(level, held, template)) next = attributeBytes(next, name, value)
  return held === "numbers" && list === undefined ? listBytes(next, "numbers", level) : next
}

function slot(root: MarkupElement, children: readonly MarkupElement[], tag: string): number {
  const target = order.indexOf(tag)
  let at = root.openEnd
  for (const child of children) {
    const rank = order.indexOf(child.kind)
    if (rank < 0) continue
    if (rank > target) return at
    at = child.end
  }
  return at
}

function listXml(list: TextList, level = 0): string {
  return list === "numbers"
    ? `<a:buAutoNum type="${levelNumbering(level)}"/>`
    : list === "bullets"
      ? `<a:buChar char="•"/>`
      : `<a:buNone/>`
}

function listBytes(slice: Uint8Array, list: TextList, level = 0): Uint8Array {
  return childBytes(slice, bulletKinds, "a:buNone", encodeUtf8(listXml(list, level)))
}

function childBytes(slice: Uint8Array, kinds: ReadonlySet<string>, tag: string, xml: Uint8Array): Uint8Array {
  const found = rootOf(slice)
  if (found === null) return slice
  const { root, children } = found
  const choices = children.filter((child) => kinds.has(child.kind))
  const first = choices[0]
  if (first !== undefined) {
    const edits = [{ start: first.start, end: first.end, next: xml }]
    for (const extra of choices.slice(1)) edits.push({ start: extra.start, end: extra.end, next: emptyBytes })
    return spliceBytes(slice, edits)
  }
  if (root.selfClosing) {
    const close = root.end - 2
    const next = joinBytes([encodeUtf8(">"), xml, encodeUtf8(`</${root.kind}>`)])
    return spliceBytes(slice, [{ start: close, end: root.end, next }])
  }
  const at = slot(root, children, tag)
  return spliceBytes(slice, [{ start: at, end: at, next: xml }])
}

export function paragraphBytes(
  bytes: Uint8Array,
  properties: MarkupElement | undefined,
  paragraph: TextParagraph,
  template: TemplateIndent = noTemplate,
): Uint8Array | null {
  const spaced = spacingNames.filter((name) => paragraph[name] !== undefined)
  if (
    paragraph.align === undefined &&
    paragraph.list === undefined &&
    paragraph.level === undefined &&
    spaced.length === 0
  )
    return null
  if (properties === undefined) return created(paragraph, template)
  let slice = bytes.subarray(properties.start, properties.end)
  if (paragraph.level !== undefined || listed(paragraph.list))
    slice = levelBytes(slice, paragraph.level ?? heldLevel(slice), paragraph.list, template)
  if (paragraph.align !== undefined) slice = alignBytes(slice, paragraph.align)
  for (const name of spaced) {
    const tag = spacingTags[name]
    slice = childBytes(slice, new Set([tag]), tag, encodeUtf8(spacingXml[name](paragraph[name] ?? 0)))
  }
  if (paragraph.list !== undefined) slice = listBytes(slice, paragraph.list, paragraph.level ?? heldLevel(slice))
  return slice
}
