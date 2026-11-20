import type { ChartSeries, ChartValue } from "@airdesign/document"
import { link, freePart, typed } from "./notes-part.js"
import { partOf, relsOf } from "./package-address.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { insertAt, replacePart, requireMarkup, within } from "./part-markup.js"
import { nextShapeId, shapeIdsIn } from "./shape-id.js"
import { shapeById } from "./shape-tree.js"
import { xmlText, type ShapeBox } from "./shape-write.js"

export type ChartShape = ShapeBox & { readonly chart: ChartValue }

export const chartContentType = "application/vnd.openxmlformats-officedocument.drawingml.chart+xml"

const chartUri = "http://schemas.openxmlformats.org/drawingml/2006/chart"
const chartNamespaces = `xmlns:c="${chartUri}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`
const accents = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"]
const quiet = '<a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln>'

function paint(at: number): string {
  return `<a:solidFill><a:schemeClr val="${accents[at % accents.length] ?? "accent1"}"/></a:solidFill>`
}

function points(values: readonly (string | number)[]): string {
  return values.map((value, at) => `<c:pt idx="${String(at)}"><c:v>${xmlText(String(value))}</c:v></c:pt>`).join("")
}

function data(categories: readonly string[], series: ChartSeries): string {
  const count = `<c:ptCount val="${String(categories.length)}"/>`
  return `<c:cat><c:strLit>${count}${points(categories)}</c:strLit></c:cat><c:val><c:numLit><c:formatCode>General</c:formatCode>${count}${points(series.values)}</c:numLit></c:val>`
}

function named(series: ChartSeries, at: number): string {
  return `<c:idx val="${String(at)}"/><c:order val="${String(at)}"/><c:tx><c:v>${xmlText(series.name)}</c:v></c:tx>`
}

function barSeries(chart: ChartValue): string {
  return chart.series
    .map(
      (series, at) =>
        `<c:ser>${named(series, at)}<c:spPr>${paint(at)}</c:spPr><c:invertIfNegative val="0"/>${data(chart.categories, series)}</c:ser>`,
    )
    .join("")
}

function lineSeries(chart: ChartValue): string {
  return chart.series
    .map(
      (series, at) =>
        `<c:ser>${named(series, at)}<c:spPr><a:ln w="28575" cap="rnd">${paint(at)}<a:round/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>${data(chart.categories, series)}<c:smooth val="0"/></c:ser>`,
    )
    .join("")
}

function pieSeries(chart: ChartValue): string {
  const [series] = chart.series
  if (series === undefined) return ""
  const slices = chart.categories
    .map(
      (_, at) =>
        `<c:dPt><c:idx val="${String(at)}"/><c:bubble3D val="0"/><c:spPr>${paint(at)}<a:ln w="12700"><a:solidFill><a:schemeClr val="bg1"/></a:solidFill></a:ln></c:spPr></c:dPt>`,
    )
    .join("")
  return `<c:ser>${named(series, 0)}${slices}${data(chart.categories, series)}</c:ser>`
}

const axes =
  `<c:catAx><c:axId val="111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr>${quiet}</c:spPr><c:crossAx val="222"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
  `<c:valAx><c:axId val="222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr>${quiet}</c:spPr></c:majorGridlines><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr><c:crossAx val="111"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`

const axisIds = '<c:axId val="111"/><c:axId val="222"/>'

function plot(chart: ChartValue): string {
  if (chart.kind === "pie")
    return `<c:pieChart><c:varyColors val="1"/>${pieSeries(chart)}<c:firstSliceAng val="0"/></c:pieChart>`
  if (chart.kind === "line")
    return `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${lineSeries(chart)}<c:marker val="1"/>${axisIds}</c:lineChart>${axes}`
  return `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${barSeries(chart)}<c:gapWidth val="80"/>${axisIds}</c:barChart>${axes}`
}

export function chartSpaceXml(chart: ChartValue): string {
  const legend = chart.series.length > 1 || chart.kind === "pie"
  const text =
    '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>'
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<c:chartSpace ${chartNamespaces}><c:roundedCorners val="0"/><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/>${plot(chart)}</c:plotArea>` +
    `${legend ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' : ""}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
    `<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${text}</c:chartSpace>`
  )
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
  parts.set(chartPart, encodeUtf8(chartSpaceXml(route.chart)))
  typed(parts, chartPart, chartContentType)
  const relationship = link(parts, route.part, "chart", chartPart)
  const slide = parts.get(route.part) ?? bytes
  replacePart(parts, route.part, insertAt(slide, tree.closeStart, encodeUtf8(chartFrame(id, route, relationship))))
}

function chartPartOf(parts: ReadonlyMap<string, Uint8Array>, part: string, shape: string): string {
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
  replacePart(next, chartPartOf(parts, part, shape), encodeUtf8(chartSpaceXml(chart)))
  return next
}
