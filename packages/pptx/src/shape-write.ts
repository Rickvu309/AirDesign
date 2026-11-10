import { insertChild } from "./child-order.js"
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

function escapeText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function paragraph(text: string): string {
  let xml = "<a:p></a:p>"
  xml = insertChild("a:p", "a:pPr", `<a:pPr algn="ctr"/>`, xml)
  xml = insertChild("a:p", "a:r", `<a:r><a:t>${escapeText(text)}</a:t></a:r>`, xml)
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

export function addTextShape(slideXml: string, text: string, box: ShapeBox): string {
  const id = nextShapeId(slideXml)
  const close = "</p:spTree>"
  const at = slideXml.lastIndexOf(close)
  if (at < 0) throw new Error("p:spTree")
  const shape = `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>${shapeProperties(box)}${textBody(text)}</p:sp>`
  return slideXml.slice(0, at) + shape + slideXml.slice(at)
}
