import { insertChild } from "./child-order.js"
import { markupDocument } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { nextShapeId } from "./shape-id.js"

export type ShapeBox = {
  readonly x: number
  readonly y: number
  readonly cx: number
  readonly cy: number
}

function requireEmu(value: number): number {
  if (!Number.isInteger(value)) throw new Error("emu")
  return value
}

function allowedChar(code: number): boolean {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  )
}

export function xmlText(value: string): string {
  let text = ""
  for (const char of value) {
    const code = char.codePointAt(0)
    if (code === undefined || !allowedChar(code)) continue
    if (char === "&") text += "&amp;"
    else if (char === "<") text += "&lt;"
    else if (char === ">") text += "&gt;"
    else text += char
  }
  return text
}

function paragraph(text: string): string {
  let xml = "<a:p></a:p>"
  xml = insertChild("a:p", "a:pPr", `<a:pPr algn="ctr"/>`, xml)
  xml = insertChild("a:p", "a:r", `<a:r><a:t>${xmlText(text)}</a:t></a:r>`, xml)
  xml = insertChild("a:p", "a:endParaRPr", `<a:endParaRPr lang="en-US"/>`, xml)
  return xml
}

function textBody(text: string): string {
  let xml = "<p:txBody></p:txBody>"
  xml = insertChild("p:txBody", "a:bodyPr", "<a:bodyPr/>", xml)
  xml = insertChild("p:txBody", "a:lstStyle", "<a:lstStyle/>", xml)
  xml = insertChild("p:txBody", "a:p", paragraph(text), xml)
  return xml
}

function shapeProperties(box: ShapeBox): string {
  const x = requireEmu(box.x)
  const y = requireEmu(box.y)
  const cx = requireEmu(box.cx)
  const cy = requireEmu(box.cy)
  let xml = "<p:spPr></p:spPr>"
  xml = insertChild(
    "p:spPr",
    "a:xfrm",
    `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`,
    xml,
  )
  xml = insertChild("p:spPr", "a:prstGeom", `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`, xml)
  return xml
}

export function addTextShape(slideXml: string, text: string, box: ShapeBox, id?: number): string {
  const shapeId = id ?? nextShapeId(slideXml)
  if (!Number.isInteger(shapeId) || shapeId < 1 || shapeId > 4294967295) throw new Error("shape id")
  const idText = String(shapeId)
  const shape = `<p:sp><p:nvSpPr><p:cNvPr id="${idText}" name="Shape ${idText}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>${shapeProperties(box)}${textBody(text)}</p:sp>`
  const bytes = encodeUtf8(slideXml)
  const document = markupDocument(bytes)
  const tree = document.elements.find((element) => element.kind === "p:spTree")
  if (!document.wellFormed || tree === undefined || tree.selfClosing || tree.closeStart < 0) throw new Error("p:spTree")
  const shapeBytes = encodeUtf8(shape)
  const merged = new Uint8Array(tree.closeStart + shapeBytes.length + bytes.length - tree.closeStart)
  merged.set(bytes.subarray(0, tree.closeStart), 0)
  merged.set(shapeBytes, tree.closeStart)
  merged.set(bytes.subarray(tree.closeStart), tree.closeStart + shapeBytes.length)
  return decodeUtf8(merged)
}
