import type { ChartValue } from "@airdesign/document"
import { chartSpaceXml, chartUri } from "./chart-space.js"
import { chartWorkbook, workbookContentType } from "./chart-workbook.js"
import { link, freePart, typed } from "./notes-part.js"
import { partOf, relativeTarget, relsOf } from "./package-address.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { insertAt, replacePart, requireMarkup, within } from "./part-markup.js"
import { nextShapeId, shapeIdsIn } from "./shape-id.js"
import { shapeById } from "./shape-tree.js"
import type { ShapeBox } from "./shape-write.js"

export type ChartShape = ShapeBox & { readonly chart: ChartValue }

export const chartContentType = "application/vnd.openxmlformats-officedocument.drawingml.chart+xml"

const embeddingPrefix = "ppt/embeddings/Microsoft_Excel_Worksheet"
const packageType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/package"

function freeWorkbook(parts: ReadonlyMap<string, Uint8Array>): string {
  let at = 1
  while (parts.has(`${embeddingPrefix}${String(at)}.xlsx`)) at += 1
  return `${embeddingPrefix}${String(at)}.xlsx`
}

function linkedWorkbook(parts: ReadonlyMap<string, Uint8Array>, chartPart: string) {
  const rels = parts.get(relsOf(chartPart))
  if (rels === undefined) return null
  for (const row of requireMarkup(rels).elements) {
    const read = (name: string) => row.attributes.find((item) => item.name === name)?.value
    const id = read("Id")
    const target = read("Target")
    if (row.kind !== "Relationship" || read("Type") !== packageType || read("TargetMode") === "External") continue
    if (id !== undefined && target !== undefined && target.endsWith(".xlsx"))
      return { id, part: partOf(chartPart, target) }
  }
  return null
}

function placeWorkbook(parts: Map<string, Uint8Array>, chartPart: string, chart: ChartValue): string {
  const linked = linkedWorkbook(parts, chartPart)
  if (linked !== null) {
    replacePart(parts, linked.part, chartWorkbook(chart))
    return linked.id
  }
  const workbook = freeWorkbook(parts)
  parts.set(workbook, chartWorkbook(chart))
  typed(parts, workbook, workbookContentType)
  const rels = relsOf(chartPart)
  if (parts.has(rels)) return link(parts, chartPart, "package", workbook)
  const row = `<Relationship Id="rId1" Type="${packageType}" Target="${relativeTarget(chartPart, workbook)}"/>`
  parts.set(
    rels,
    encodeUtf8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${row}</Relationships>`,
    ),
  )
  return "rId1"
}

function chartFrame(id: number, shape: ShapeBox, relationship: string): string {
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${String(id)}" name="Chart ${String(id)}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${String(shape.x)}" y="${String(shape.y)}"/><a:ext cx="${String(shape.cx)}" cy="${String(shape.cy)}"/></p:xfrm><a:graphic><a:graphicData uri="${chartUri}"><c:chart xmlns:c="${chartUri}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${relationship}"/></a:graphicData></a:graphic></p:graphicFrame>`
}

export function addChart(
  parts: Map<string, Uint8Array>,
  route: ChartShape & { readonly part: string; readonly id?: number },
) {
  const bytes = parts.get(route.part)
  if (bytes === undefined) throw new Error("slide")
  const tree = requireMarkup(bytes).elements.find((element) => element.kind === "p:spTree")
  if (tree === undefined || tree.selfClosing || tree.closeStart < 0) throw new Error("p:spTree")
  const id = route.id ?? nextShapeId(decodeUtf8(bytes))
  if (!Number.isInteger(id) || id < 2 || shapeIdsIn(bytes).includes(String(id))) throw new Error("shape id")
  if (![route.x, route.y, route.cx, route.cy].every(Number.isSafeInteger)) throw new Error("emu")
  const chartPart = freePart(parts, "ppt/charts/chart")
  const workbook = placeWorkbook(parts, chartPart, route.chart)
  parts.set(chartPart, encodeUtf8(chartSpaceXml(route.chart, workbook)))
  typed(parts, chartPart, chartContentType)
  const relationship = link(parts, route.part, "chart", chartPart)
  const slide = parts.get(route.part) ?? bytes
  replacePart(parts, route.part, insertAt(slide, tree.closeStart, encodeUtf8(chartFrame(id, route, relationship))))
}

export function chartPartOf(parts: ReadonlyMap<string, Uint8Array>, part: string, shape: string): string {
  const bytes = parts.get(part)
  if (bytes === undefined) throw new Error("slide")
  const { elements } = requireMarkup(bytes)
  const frame = shapeById(elements, shape)
  const chart = elements.find((element) => element.kind === "c:chart" && within(elements, element, frame))
  const id = chart?.attributes.find((item) => item.name === "r:id")?.value
  const rels = parts.get(relsOf(part))
  if (id === undefined || rels === undefined) throw new Error("c:chart")
  const row = requireMarkup(rels).elements.find(
    (element) =>
      element.kind === "Relationship" && element.attributes.some((item) => item.name === "Id" && item.value === id),
  )
  const target = row?.attributes.find((item) => item.name === "Target")?.value
  if (target === undefined) throw new Error("c:chart")
  return partOf(part, target)
}

export function writeChart(
  parts: ReadonlyMap<string, Uint8Array>,
  part: string,
  shape: string,
  chart: ChartValue,
): ReadonlyMap<string, Uint8Array> {
  const next = new Map(parts)
  const chartPart = chartPartOf(parts, part, shape)
  replacePart(next, chartPart, encodeUtf8(chartSpaceXml(chart, placeWorkbook(next, chartPart, chart))))
  return next
}
