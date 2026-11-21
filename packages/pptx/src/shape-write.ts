import { lineGeometries, type Geometry } from "@airdesign/document"
import { markupDocument } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { nextShapeId, shapeIdsIn } from "./shape-id.js"
import { newShapeName, newTextName } from "./layer-names.js"

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

export function xmlAttribute(value: string): string {
  return xmlText(value).replaceAll('"', "&quot;")
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

export type NewTextAlign = "left" | "center"

function paragraph(text: string, align: NewTextAlign): string {
  const properties = align === "center" ? `<a:pPr algn="ctr"/>` : ""
  return `<a:p>${properties}<a:r><a:t>${xmlText(text)}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`
}

function textBody(text: string, align: NewTextAlign): string {
  return `<p:txBody><a:bodyPr/><a:lstStyle/>${paragraph(text, align)}</p:txBody>`
}

function shapeProperties(box: ShapeBox): string {
  return `<p:spPr>${shapeBox(box)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>`
}

export function appendShape(
  slideXml: string,
  markup: (id: string) => string,
  id?: number,
): { readonly xml: string; readonly id: number } {
  const shapeId = id ?? nextShapeId(slideXml)
  if (!Number.isInteger(shapeId) || shapeId < 1 || shapeId > 4294967295) throw new Error("shape id")
  const idText = String(shapeId)
  const bytes = encodeUtf8(slideXml)
  const document = markupDocument(bytes)
  if (shapeIdsIn(bytes).includes(idText)) throw new Error("shape id")
  const tree = document.elements.find((element) => element.kind === "p:spTree")
  if (!document.wellFormed || tree === undefined || tree.selfClosing || tree.closeStart < 0) throw new Error("p:spTree")
  const shapeBytes = encodeUtf8(markup(idText))
  const merged = new Uint8Array(tree.closeStart + shapeBytes.length + bytes.length - tree.closeStart)
  merged.set(bytes.subarray(0, tree.closeStart), 0)
  merged.set(shapeBytes, tree.closeStart)
  merged.set(bytes.subarray(tree.closeStart), tree.closeStart + shapeBytes.length)
  return { xml: decodeUtf8(merged), id: shapeId }
}

export function shapeBox(box: ShapeBox): string {
  const x = requireEmu(box.x)
  const y = requireEmu(box.y)
  const cx = requireEmu(box.cx)
  const cy = requireEmu(box.cy)
  return `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`
}

export function textShapeXml(idText: string, text: string, box: ShapeBox, align: NewTextAlign = "center"): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${idText}" name="${newTextName}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>${shapeProperties(box)}${textBody(text, align)}</p:sp>`
}

export function addTextShape(
  slideXml: string,
  text: string,
  box: ShapeBox,
  id?: number,
  align: NewTextAlign = "center",
): { readonly xml: string; readonly id: number } {
  return appendShape(slideXml, (idText) => textShapeXml(idText, text, box, align), id)
}

const shapeStyle =
  '<p:style><a:lnRef idx="2"><a:schemeClr val="accent1"><a:shade val="15000"/></a:schemeClr></a:lnRef><a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></p:style>'

const lineStyle =
  '<p:style><a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="0"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef></p:style>'

const shapeText =
  '<p:txBody><a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:endParaRPr lang="en-US"/></a:p></p:txBody>'

const lineWeight = 28575
const lineStroke = `<a:ln w="${String(lineWeight)}"/>`
const arrowEnd = `<a:ln w="${String(lineWeight)}"><a:tailEnd type="triangle"/></a:ln>`

function drawnProperties(geometry: Geometry, box: ShapeBox): string {
  const end = geometry === "straightConnector1" ? arrowEnd : lineGeometries.includes(geometry) ? lineStroke : ""
  return `<p:spPr>${shapeBox(box)}<a:prstGeom prst="${geometry}"><a:avLst/></a:prstGeom>${end}</p:spPr>`
}

export function drawnShapeXml(idText: string, geometry: Geometry, box: ShapeBox, holdsText = false): string {
  const name = `<p:cNvPr id="${idText}" name="${newShapeName(geometry, idText)}"/>`
  const properties = drawnProperties(geometry, box)
  if (lineGeometries.includes(geometry))
    return `<p:cxnSp><p:nvCxnSpPr>${name}<p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>${properties}${lineStyle}</p:cxnSp>`
  return `<p:sp><p:nvSpPr>${name}<p:cNvSpPr/><p:nvPr/></p:nvSpPr>${properties}${shapeStyle}${holdsText ? shapeText : ""}</p:sp>`
}

export function addDrawnShape(
  slideXml: string,
  geometry: Geometry,
  box: ShapeBox,
  id?: number,
  holdsText = false,
): { readonly xml: string; readonly id: number } {
  return appendShape(slideXml, (idText) => drawnShapeXml(idText, geometry, box, holdsText), id)
}
