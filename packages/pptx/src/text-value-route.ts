import type { TextParagraph, TextRun, TextValue } from "@airdesign/document"
import { contentSpans, decodedXmlText, type ByteEdit, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { paragraphBytes } from "./paragraph-format.js"
import { formatEdits, formattedInline, runProperties } from "./run-format.js"
import { xmlText } from "./shape-write.js"

export type MarkupChildren = readonly (readonly MarkupElement[])[]

export type SourceInline = {
  readonly element: MarkupElement
  readonly format: MarkupElement | undefined
  readonly holder: MarkupElement | undefined
  readonly text: string
}

export type SourceParagraph = {
  readonly element: MarkupElement
  readonly properties: MarkupElement | undefined
  readonly inlines: readonly SourceInline[]
  readonly end: MarkupElement | undefined
  readonly copyable: boolean
}

const inlineKinds = new Set(["a:r", "a:br", "a:fld"])
const paragraphKinds = new Set(["a:pPr", "a:endParaRPr", ...inlineKinds])
const emptyBytes = new Uint8Array(0)
const runOpen = encodeUtf8("<a:r>")
const runClose = encodeUtf8("</a:r>")
const textOpen = encodeUtf8("<a:t>")
const textClose = encodeUtf8("</a:t>")
const paragraphOpen = encodeUtf8("<a:p>")
const paragraphClose = encodeUtf8("</a:p>")

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

export function holderText(bytes: Uint8Array, holder: MarkupElement | undefined): string {
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

export function sourceBody(
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

export function shownText(value: TextValue): string {
  return value.flatMap((paragraph) => paragraph.runs.map((run) => (run.text === "\n" ? "" : run.text))).join("")
}

export type OneRun = { readonly paragraph: number; readonly run: number }

export function oneRunIn(value: TextValue): OneRun | null {
  const paragraph = value[0]
  const run = paragraph?.runs[0]
  if (value.length !== 1 || paragraph === undefined || paragraph.runs.length !== 1) return null
  if (run === undefined || run.text === "" || run.text === "\n") return null
  return { paragraph: paragraph.from, run: run.from }
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

function writtenText(bytes: Uint8Array, holder: MarkupElement | undefined, text: string): Uint8Array {
  const open = holder === undefined ? textOpen : openTag(bytes, holder, textOpen)
  return joinBytes([open, encodeUtf8(xmlText(text)), textClose])
}

function writtenRun(bytes: Uint8Array, source: SourceParagraph, wanted: TextRun): Uint8Array {
  if (wanted.from === -1) {
    refuseBreak(wanted.text)
    return joinBytes([
      runOpen,
      runProperties(bytes, source.end, wanted),
      writtenText(bytes, undefined, wanted.text),
      runClose,
    ])
  }
  const origin = source.inlines[wanted.from]
  if (origin === undefined) throw new Error("text-run")
  if (origin.element.kind !== "a:r") {
    if (origin.text !== wanted.text) throw new Error("text-carried")
    return formattedInline(bytes, origin, wanted)
  }
  if (origin.text !== wanted.text) refuseBreak(wanted.text)
  return joinBytes([
    openTag(bytes, origin.element, runOpen),
    runProperties(bytes, origin.format, wanted),
    writtenText(bytes, origin.holder, wanted.text),
    runClose,
  ])
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false
  return true
}

function propertiesBytes(bytes: Uint8Array, source: SourceParagraph, wanted: TextParagraph): Uint8Array {
  return paragraphBytes(bytes, source.properties, wanted) ?? copied(bytes, source.properties)
}

function writtenParagraph(bytes: Uint8Array, source: SourceParagraph, wanted: TextParagraph): Uint8Array {
  if (!source.copyable) throw new Error("text-carried")
  return joinBytes([
    openTag(bytes, source.element, paragraphOpen),
    propertiesBytes(bytes, source, wanted),
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
  const formatted = paragraphBytes(bytes, source.properties, wanted)
  if (formatted !== null) {
    if (source.properties === undefined) {
      const at = source.element.selfClosing ? source.element.end - 2 : source.element.openEnd
      const next = source.element.selfClosing
        ? joinBytes([encodeUtf8(">"), formatted, encodeUtf8(`</${source.element.kind}>`)])
        : formatted
      edits.push({ start: at, end: source.element.selfClosing ? source.element.end : at, next })
    } else if (!sameBytes(bytes.subarray(source.properties.start, source.properties.end), formatted)) {
      edits.push({ start: source.properties.start, end: source.properties.end, next: formatted })
    }
  }
  for (const [index, run] of wanted.runs.entries()) {
    const origin = source.inlines[index]
    if (origin === undefined || run.from !== index) return null
    edits.push(...formatEdits(bytes, origin, run))
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
