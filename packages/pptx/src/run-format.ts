import { formatNames, type TextFormat, type TextRun } from "@airdesign/document"
import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"
import type { SourceInline } from "./text-value-route.js"

const propertiesKind = "a:rPr"
const emptyBytes = new Uint8Array(0)
const written: Readonly<Record<TextFormat, readonly [name: string, on: string, off: string]>> = {
  bold: ["b", "1", "0"],
  italic: ["i", "1", "0"],
  underline: ["u", "sng", "none"],
}

function settings(run: TextRun): readonly (readonly [string, string])[] {
  return formatNames.flatMap((format) => {
    const on = run[format]
    if (on === undefined) return []
    const [name, yes, no] = written[format]
    return [[name, on ? yes : no] as const]
  })
}

function attributeText(set: readonly (readonly [string, string])[]): string {
  return set.map(([name, value]) => ` ${name}="${value}"`).join("")
}

function shifted(edits: readonly ByteEdit[], by: number): readonly ByteEdit[] {
  return edits.map((edit) => ({ start: edit.start - by, end: edit.end - by, next: edit.next }))
}

export function runProperties(bytes: Uint8Array, source: MarkupElement | undefined, run: TextRun): Uint8Array {
  const set = settings(run)
  if (source === undefined)
    return set.length === 0 ? emptyBytes : encodeUtf8(`<${propertiesKind}${attributeText(set)}/>`)
  const nameStart = source.start + 1
  const nameEnd = nameStart + source.kind.length
  const edits: ByteEdit[] = []
  if (source.kind !== propertiesKind) {
    edits.push({ start: nameStart, end: nameEnd, next: encodeUtf8(propertiesKind) })
    if (!source.selfClosing) {
      edits.push({ start: source.closeStart, end: source.end, next: encodeUtf8(`</${propertiesKind}>`) })
    }
  }
  const added: (readonly [string, string])[] = []
  for (const [name, value] of set) {
    const found = source.attributes.find((attribute) => attribute.name === name)
    if (found === undefined) added.push([name, value])
    else edits.push({ start: found.valueStart, end: found.valueEnd, next: encodeUtf8(value) })
  }
  if (added.length > 0) {
    const at = source.attributes.reduce((last, attribute) => Math.max(last, attribute.valueEnd + 1), nameEnd)
    edits.push({ start: at, end: at, next: encodeUtf8(attributeText(added)) })
  }
  return spliceBytes(bytes.subarray(source.start, source.end), shifted(edits, source.start))
}

export function formatEdits(bytes: Uint8Array, inline: SourceInline, run: TextRun): readonly ByteEdit[] {
  if (settings(run).length === 0) return []
  const { element, format } = inline
  if (format !== undefined) return [{ start: format.start, end: format.end, next: runProperties(bytes, format, run) }]
  const added = runProperties(bytes, undefined, run)
  if (!element.selfClosing) return [{ start: element.openEnd, end: element.openEnd, next: added }]
  const close = element.end - 2
  const next = new Uint8Array([...encodeUtf8(">"), ...added, ...encodeUtf8(`</${element.kind}>`)])
  return [{ start: close, end: element.end, next }]
}

export function formattedInline(bytes: Uint8Array, inline: SourceInline, run: TextRun): Uint8Array {
  const { element } = inline
  return spliceBytes(
    bytes.subarray(element.start, element.end),
    shifted(formatEdits(bytes, inline, run), element.start),
  )
}
