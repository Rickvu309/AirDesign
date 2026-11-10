import type { TextParagraph, TextRun, TextValue } from "@airdesign/document"
import { contentSpans, type ByteEdit, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { xmlText } from "./shape-write.js"

export type MarkupChildren = readonly (readonly MarkupElement[])[]

type SourceInline = {
  readonly element: MarkupElement
  readonly format: MarkupElement | undefined
  readonly holder: MarkupElement | undefined
  readonly text: string
}

type SourceParagraph = {
  readonly element: MarkupElement
  readonly properties: MarkupElement | undefined
  readonly inlines: readonly SourceInline[]
  readonly end: MarkupElement | undefined
  readonly copyable: boolean
}

const inlineKinds = new Set(["a:r", "a:br", "a:fld"])
const paragraphKinds = new Set(["a:pPr", "a:endParaRPr", ...inlineKinds])
const namedReferences = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
])
const emptyBytes = new Uint8Array(0)
const runOpen = encodeUtf8("<a:r>")
const runClose = encodeUtf8("</a:r>")
const textOpen = encodeUtf8("<a:t>")
const textClose = encodeUtf8("</a:t>")
const paragraphOpen = encodeUtf8("<a:p>")
const paragraphClose = encodeUtf8("</a:p>")
const formatOpen = encodeUtf8("<a:rPr")
const formatClose = encodeUtf8("</a:rPr>")

function numericReference(token: string): string | null {
  const hex = token[1] === "x"
  const digits = token.slice(hex ? 2 : 1)
  if (!(hex ? /^[0-9a-fA-F]+$/ : /^[0-9]+$/).test(digits)) return null
  const code = Number.parseInt(digits, hex ? 16 : 10)
  if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return null
  return String.fromCodePoint(code)
}

function referenceText(token: string): string | null {
  return token.startsWith("#") ? numericReference(token) : (namedReferences.get(token) ?? null)
}

export function decodedXmlText(value: string): string {
  let text = ""
  let start = 0
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "&") continue
    let end = index + 1
    while (end < value.length && value[end] !== ";") end += 1
    if (end >= value.length) return text + value.slice(start)
    const decoded = referenceText(value.slice(index + 1, end))
    text += value.slice(start, index) + (decoded ?? value.slice(index, end + 1))
    start = end + 1
    index = end
  }
  return text + value.slice(start)
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

export function markupChildren(elements: readonly MarkupElement[]): MarkupChildren {
  const children: MarkupElement[][] = elements.map(() => [])
  for (const element of elements) children[element.parent]?.push(element)
  return children
}

function childrenOf(children: MarkupChildren, parent: MarkupElement): readonly MarkupElement[] {
  return children[parent.index] ?? []
}

function holderText(bytes: Uint8Array, holder: MarkupElement | undefined): string {
  if (holder === undefined) return ""
  return contentSpans(bytes, holder)
    .map((span) => {
      const text = decodeUtf8(bytes.subarray(span.start, span.end))
      return span.literal ? text : decodedXmlText(text)
    })
    .join("")
}

function sourceInline(children: MarkupChildren, bytes: Uint8Array, element: MarkupElement): SourceInline {
  const parts = childrenOf(children, element)
  const holder = parts.find((part) => part.kind === "a:t")
  return {
    element,
    format: parts.find((part) => part.kind === "a:rPr"),
    holder,
    text: element.kind === "a:br" ? "\n" : holderText(bytes, holder),
  }
}

function sourceParagraph(children: MarkupChildren, bytes: Uint8Array, element: MarkupElement): SourceParagraph {
  const parts = childrenOf(children, element)
  return {
    element,
    properties: parts.find((part) => part.kind === "a:pPr"),
    inlines: parts.filter((part) => inlineKinds.has(part.kind)).map((part) => sourceInline(children, bytes, part)),
    end: parts.find((part) => part.kind === "a:endParaRPr"),
    copyable: parts.every((part) => paragraphKinds.has(part.kind)),
  }
}

function sourceBody(
  children: MarkupChildren,
  bytes: Uint8Array,
  shape: MarkupElement,
): readonly SourceParagraph[] | null {
  const body = childrenOf(children, shape).find((part) => part.kind === "p:txBody" || part.kind === "a:txBody")
  if (body === undefined || body.selfClosing) return null
  return childrenOf(children, body)
    .filter((part) => part.kind === "a:p")
    .map((part) => sourceParagraph(children, bytes, part))
}

export function shapeTextValue(children: MarkupChildren, bytes: Uint8Array, shape: MarkupElement): TextValue {
  return (sourceBody(children, bytes, shape) ?? []).map((paragraph, from) => ({
    from,
    runs: paragraph.inlines.map((inline, run) => ({ from: run, text: inline.text })),
  }))
}

export function oneRunValue(value: TextValue, text: string): TextValue {
  const paragraph = value[0]
  const run = paragraph?.runs[0]
  if (value.length !== 1 || paragraph === undefined || paragraph.runs.length !== 1) throw new Error("text-shape")
  if (run === undefined || run.text === "" || run.text === "\n") throw new Error("text-shape")
  return [{ from: paragraph.from, runs: [{ from: run.from, text }] }]
}

function refuseBreak(text: string): void {
  if (text.includes("\n") || text.includes("\r")) throw new Error("text-break")
}

function copied(bytes: Uint8Array, element: MarkupElement | undefined): Uint8Array {
  return element === undefined ? emptyBytes : bytes.subarray(element.start, element.end)
}

function openTag(bytes: Uint8Array, element: MarkupElement, written: Uint8Array): Uint8Array {
  return element.selfClosing ? written : bytes.subarray(element.start, element.openEnd)
}

function endFormat(bytes: Uint8Array, end: MarkupElement | undefined): Uint8Array {
  if (end === undefined) return emptyBytes
  const rest = end.start + end.kind.length + 1
  if (end.selfClosing) return joinBytes([formatOpen, bytes.subarray(rest, end.end)])
  return joinBytes([formatOpen, bytes.subarray(rest, end.closeStart), formatClose])
}

function writtenText(bytes: Uint8Array, holder: MarkupElement | undefined, text: string): Uint8Array {
  const open = holder === undefined ? textOpen : openTag(bytes, holder, textOpen)
  return joinBytes([open, encodeUtf8(xmlText(text)), textClose])
}

function writtenRun(bytes: Uint8Array, source: SourceParagraph, wanted: TextRun): Uint8Array {
  if (wanted.from === -1) {
    refuseBreak(wanted.text)
    return joinBytes([runOpen, endFormat(bytes, source.end), writtenText(bytes, undefined, wanted.text), runClose])
  }
  const origin = source.inlines[wanted.from]
  if (origin === undefined) throw new Error("text-run")
  if (origin.element.kind !== "a:r") {
    if (origin.text !== wanted.text) throw new Error("text-carried")
    return copied(bytes, origin.element)
  }
  if (origin.text !== wanted.text) refuseBreak(wanted.text)
  return joinBytes([
    openTag(bytes, origin.element, runOpen),
    copied(bytes, origin.format),
    writtenText(bytes, origin.holder, wanted.text),
    runClose,
  ])
}

function writtenParagraph(bytes: Uint8Array, source: SourceParagraph, wanted: TextParagraph): Uint8Array {
  if (!source.copyable) throw new Error("text-carried")
  return joinBytes([
    openTag(bytes, source.element, paragraphOpen),
    copied(bytes, source.properties),
    ...wanted.runs.map((run) => writtenRun(bytes, source, run)),
    copied(bytes, source.end),
    paragraphClose,
  ])
}

function textEdit(holder: MarkupElement, text: string, bytes: Uint8Array): ByteEdit {
  if (holder.selfClosing) return { start: holder.start, end: holder.end, next: writtenText(bytes, holder, text) }
  return { start: holder.openEnd, end: holder.closeStart, next: encodeUtf8(xmlText(text)) }
}

function keptEdits(bytes: Uint8Array, source: SourceParagraph, wanted: TextParagraph): readonly ByteEdit[] | null {
  if (wanted.runs.length !== source.inlines.length) return null
  const edits: ByteEdit[] = []
  for (const [index, run] of wanted.runs.entries()) {
    const origin = source.inlines[index]
    if (origin === undefined || run.from !== index) return null
    if (run.text === origin.text) continue
    if (origin.element.kind !== "a:r" || origin.holder === undefined) return null
    refuseBreak(run.text)
    edits.push(textEdit(origin.holder, run.text, bytes))
  }
  return edits
}

export function textValueEdits(
  children: MarkupChildren,
  bytes: Uint8Array,
  shape: MarkupElement,
  value: TextValue,
): readonly ByteEdit[] {
  const paragraphs = sourceBody(children, bytes, shape)
  if (paragraphs === null) throw new Error("text-body")
  if (value.length === 0) throw new Error("text-empty")
  const edits: ByteEdit[] = []
  const seen = new Set<number>()
  let pending: Uint8Array[] = []
  let next = 0
  const place = (until: number) => {
    const dropped = paragraphs.slice(next, until).map((paragraph) => paragraph.element)
    const written = joinBytes(pending)
    pending = []
    const first = dropped[0]
    if (first === undefined) {
      const at = paragraphs[until]?.element.start ?? paragraphs.at(-1)?.element.end
      if (written.length > 0 && at !== undefined) edits.push({ start: at, end: at, next: written })
      return
    }
    edits.push({ start: first.start, end: first.end, next: written })
    for (const extra of dropped.slice(1)) edits.push({ start: extra.start, end: extra.end, next: emptyBytes })
  }
  for (const wanted of value) {
    const source = paragraphs[wanted.from]
    if (source === undefined) throw new Error("text-paragraph")
    const kept = wanted.from >= next && !seen.has(wanted.from) ? keptEdits(bytes, source, wanted) : null
    seen.add(wanted.from)
    if (kept === null) {
      pending.push(writtenParagraph(bytes, source, wanted))
      continue
    }
    place(wanted.from)
    edits.push(...kept)
    next = wanted.from + 1
  }
  place(paragraphs.length)
  return edits
}
