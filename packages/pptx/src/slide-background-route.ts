import type { RunColor } from "@airdesign/document"
import { spliceBytes } from "./element-span.js"
import { slidePart } from "./package-address.js"
import { encodeUtf8 } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"

function colorText(color: RunColor): string {
  return "scheme" in color ? `<a:schemeClr val="${color.scheme}"/>` : `<a:srgbClr val="${color.rgb}"/>`
}

export function backgroundText(color: RunColor): string {
  return `<p:bg><p:bgPr><a:solidFill>${colorText(color)}</a:solidFill><a:effectLst/></p:bgPr></p:bg>`
}

function painted(bytes: Uint8Array, color: RunColor): Uint8Array {
  const { elements } = requireMarkup(bytes)
  const root = elements.find((element) => element.parent < 0)
  const body = elements.find((element) => element.kind === "p:cSld" && element.parent === root?.index)
  if (body === undefined || body.selfClosing) throw new Error("p:cSld")
  const own = elements.find((element) => element.kind === "p:bg" && element.parent === body.index)
  const next = encodeUtf8(backgroundText(color))
  const span = own === undefined ? { start: body.openEnd, end: body.openEnd } : { start: own.start, end: own.end }
  return spliceBytes(bytes, [{ ...span, next }])
}

export function withBackground(
  parts: ReadonlyMap<string, Uint8Array>,
  slide: string,
  color: RunColor | null,
): ReadonlyMap<string, Uint8Array> {
  if (color === null) return parts
  const part = slidePart(parts, slide)
  if (part === null) throw new Error("slide")
  const next = new Map(parts)
  next.set(part, painted(partBytes(parts, part), color))
  return next
}
