import type { TransitionValue } from "@airdesign/document"
import { markupDocument, spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { fromSide, p14Namespace, pushDir, speedOf } from "./transition-map.js"
import { transitionBlocks } from "./transition-read.js"
import type { Parts } from "./xml-codec.js"

function withPart(parts: Parts, part: string, bytes: Uint8Array): Parts {
  const next = new Map(parts)
  next.set(part, bytes)
  return next
}

function openTag(bytes: Uint8Array, element: MarkupElement): string {
  return decodeUtf8(bytes.subarray(element.start, element.openEnd - 2)).trimEnd()
}

function effectOf(value: TransitionValue): string | null {
  if ("none" in value) return null
  if ("dissolve" in value) return "<p:fade/>"
  if ("push" in value) return `<p:push dir="${pushDir[value.push.direction]}"/>`
  if ("moveIn" in value) return `<p:cover dir="${fromSide[value.moveIn.direction]}"/>`
  return `<p:pull dir="${fromSide[value.moveOut.direction]}"/>`
}

function durationOf(value: TransitionValue): number | null {
  if ("dissolve" in value) return value.dissolve.duration
  if ("push" in value) return value.push.duration
  if ("moveIn" in value) return value.moveIn.duration
  if ("moveOut" in value) return value.moveOut.duration
  return null
}

function advanceOf(value: TransitionValue): { readonly click: true } | { readonly delay: number } {
  if ("none" in value) return value.none.advance
  if ("dissolve" in value) return value.dissolve.advance
  if ("push" in value) return value.push.advance
  if ("moveIn" in value) return value.moveIn.advance
  return value.moveOut.advance
}

function canonical(value: TransitionValue): string | null {
  const advance = advanceOf(value)
  const delay = "delay" in advance ? ` advClick="0" advTm="${String(advance.delay)}"` : ""
  const effect = effectOf(value)
  if (effect === null) return delay === "" ? null : `<p:transition${delay}/>`
  const duration = durationOf(value)
  if (duration === null) throw new Error("transition")
  return `<p:transition xmlns:p14="${p14Namespace}" spd="${speedOf(duration)}" p14:dur="${String(duration)}"${delay}>${effect}</p:transition>`
}

function insertPoint(elements: readonly MarkupElement[], root: MarkupElement): number {
  const children = elements.filter((element) => element.parent === root.index)
  const colors = children.find((element) => element.kind === "p:clrMapOvr")
  const before = children.find((element) => element.kind === "p:timing" || element.kind === "p:extLst")
  if (colors !== undefined && (before === undefined || colors.end <= before.start)) return before?.start ?? colors.end
  if (before !== undefined) return before.start
  return root.closeStart
}

export function writeArrival(parts: Parts, part: string, value: TransitionValue): Parts {
  const bytes = parts.get(part)
  if (bytes === undefined) throw new Error("transition")
  const document = markupDocument(bytes)
  const root = document.elements.find((element) => element.kind === "p:sld")
  if (!document.wellFormed || root === undefined) throw new Error("transition")
  const xml = canonical(value)
  const blocks = transitionBlocks(document.elements)
  let edits: ByteEdit[]
  if (root.selfClosing) {
    if (xml === null) return parts
    edits = [
      {
        start: root.start,
        end: root.end,
        next: encodeUtf8(`${openTag(bytes, root)}>${xml}</${root.kind}>`),
      },
    ]
  } else if (blocks.length === 0) {
    if (xml === null) return parts
    const at = insertPoint(document.elements, root)
    edits = [{ start: at, end: at, next: encodeUtf8(xml) }]
  } else {
    const [first, ...rest] = blocks
    if (first === undefined) throw new Error("transition")
    edits = [
      { start: first.start, end: first.end, next: encodeUtf8(xml ?? "") },
      ...rest.map((block) => ({ start: block.start, end: block.end, next: new Uint8Array() })),
    ]
  }
  const next = spliceBytes(bytes, edits)
  return sameBytes(next, bytes) ? parts : withPart(parts, part, next)
}
