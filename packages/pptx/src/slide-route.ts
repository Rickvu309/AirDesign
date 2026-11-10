import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { addTextShape } from "./shape-write.js"

export type SlideRoute =
  | { readonly name: "text"; readonly part: string; readonly shape: string; readonly text: string }
  | { readonly name: "move"; readonly part: string; readonly shape: string; readonly x: number; readonly y: number }
  | { readonly name: "resize"; readonly part: string; readonly shape: string; readonly cx: number; readonly cy: number }
  | {
      readonly name: "add"
      readonly part: string
      readonly text: string
      readonly x: number
      readonly y: number
      readonly cx: number
      readonly cy: number
    }
  | { readonly name: "remove"; readonly part: string; readonly shape: string }

function emu(value: number): number {
  if (!Number.isInteger(value)) throw new Error("emu")
  return value
}

function escapeText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function shapeSlice(xml: string, shape: string): { readonly start: number; readonly end: number } {
  const marker = `<p:cNvPr id="${shape}"`
  const idAt = xml.indexOf(marker)
  if (idAt < 0) throw new Error("shape")
  const plain = xml.lastIndexOf("<p:sp>", idAt)
  const attributed = xml.lastIndexOf("<p:sp ", idAt)
  const start = Math.max(plain, attributed)
  if (start < 0) throw new Error("shape")
  let depth = 0
  for (let index = start; index < xml.length;) {
    if (xml.startsWith("</p:sp>", index)) {
      depth -= 1
      if (depth === 0) return { start, end: index + "</p:sp>".length }
      index += "</p:sp>".length
      continue
    }
    if (xml.startsWith("<p:sp>", index) || xml.startsWith("<p:sp ", index)) {
      depth += 1
      index += "<p:sp".length
      continue
    }
    index += 1
  }
  throw new Error("shape")
}

function replaceShape(xml: string, shape: string, edit: (shapeXml: string) => string): string {
  const span = shapeSlice(xml, shape)
  const current = xml.slice(span.start, span.end)
  const next = edit(current)
  return xml.slice(0, span.start) + next + xml.slice(span.end)
}

function replaceText(shapeXml: string, text: string): string {
  const open = shapeXml.indexOf("<a:t")
  if (open < 0) throw new Error("text")
  const start = shapeXml.indexOf(">", open)
  const end = shapeXml.indexOf("</a:t>", start)
  if (start < 0 || end < 0) throw new Error("text")
  return shapeXml.slice(0, start + 1) + escapeText(text) + shapeXml.slice(end)
}

function replaceAttributes(shapeXml: string, tagName: string, values: readonly (readonly [string, string])[]): string {
  const open = shapeXml.indexOf(`<${tagName} `)
  if (open < 0) throw new Error(tagName)
  const close = shapeXml.indexOf("/>", open)
  if (close < 0) throw new Error(tagName)
  let tag = shapeXml.slice(open, close + 2)
  for (const [name, value] of values) {
    const pattern = new RegExp(`\\b${name}="-?\\d+"`)
    if (pattern.exec(tag) === null) throw new Error(tagName)
    tag = tag.replace(pattern, `${name}="${value}"`)
  }
  return shapeXml.slice(0, open) + tag + shapeXml.slice(close + 2)
}

function editPart(xml: string, route: SlideRoute): string {
  if (route.name === "text") return replaceShape(xml, route.shape, (shapeXml) => replaceText(shapeXml, route.text))
  if (route.name === "move") {
    const x = String(emu(route.x))
    const y = String(emu(route.y))
    return replaceShape(xml, route.shape, (shapeXml) =>
      replaceAttributes(shapeXml, "a:off", [
        ["x", x],
        ["y", y],
      ]),
    )
  }
  if (route.name === "resize") {
    const cx = String(emu(route.cx))
    const cy = String(emu(route.cy))
    return replaceShape(xml, route.shape, (shapeXml) =>
      replaceAttributes(shapeXml, "a:ext", [
        ["cx", cx],
        ["cy", cy],
      ]),
    )
  }
  if (route.name === "add") {
    return addTextShape(xml, route.text, {
      x: emu(route.x),
      y: emu(route.y),
      cx: emu(route.cx),
      cy: emu(route.cy),
    })
  }
  const span = shapeSlice(xml, route.shape)
  return xml.slice(0, span.start) + xml.slice(span.end)
}

export function applyRoute(parts: ReadonlyMap<string, Uint8Array>, route: SlideRoute): ReadonlyMap<string, Uint8Array> {
  const current = parts.get(route.part)
  if (current === undefined) throw new Error("part")
  const xml = decodeUtf8(current)
  const nextXml = editPart(xml, route)
  const next = new Map(parts)
  next.set(route.part, nextXml === xml ? current : encodeUtf8(nextXml))
  return next
}
