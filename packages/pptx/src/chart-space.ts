import { chartGap, chartLegend, type ChartSeries, type ChartValue } from "@airdesign/document"
import { chartFormulas } from "./chart-workbook.js"
import { solidFillXml } from "./color-xml.js"
import { xmlAttribute, xmlText } from "./shape-write.js"

export const chartUri = "http://schemas.openxmlformats.org/drawingml/2006/chart"

const chartNamespaces = `xmlns:c="${chartUri}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`
const accents = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"] as const
const quiet = '<a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln>'
export const chartGridlinesXml = `<c:majorGridlines><c:spPr>${quiet}</c:spPr></c:majorGridlines>`
export const chartLineWidth = 28575
const ink = '<a:solidFill><a:schemeClr val="tx1"/></a:solidFill>'
const legendPlaces = { bottom: "b", top: "t", right: "r", left: "l" } as const
const titleSize = 1400
const labelSize = 1100

function accent(at: number): string {
  return solidFillXml({ scheme: accents[at % accents.length] ?? "accent1" })
}

export function seriesFillXml(series: ChartSeries, at: number): string {
  return series.color === undefined ? accent(at) : solidFillXml(series.color)
}

function points(values: readonly (string | number)[]): string {
  return values.map((value, at) => `<c:pt idx="${String(at)}"><c:v>${xmlText(String(value))}</c:v></c:pt>`).join("")
}

function count(length: number): string {
  return `<c:ptCount val="${String(length)}"/>`
}

type SeriesCells = { readonly categories: string; readonly name: string; readonly values: string }

function cellsOf(chart: ChartValue, at: number): SeriesCells {
  const formulas = chartFormulas(chart)
  return { categories: formulas.categories, ...(formulas.series[at] ?? { name: "", values: "" }) }
}

function named(series: ChartSeries, at: number, cells: SeriesCells): string {
  return `<c:idx val="${String(at)}"/><c:order val="${String(at)}"/><c:tx><c:strRef><c:f>${cells.name}</c:f><c:strCache>${count(1)}${points([series.name])}</c:strCache></c:strRef></c:tx>`
}

function data(chart: ChartValue, series: ChartSeries, cells: SeriesCells): string {
  const length = count(chart.categories.length)
  return `<c:cat><c:strRef><c:f>${cells.categories}</c:f><c:strCache>${length}${points(chart.categories)}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>${cells.values}</c:f><c:numCache><c:formatCode>General</c:formatCode>${length}${points(series.values)}</c:numCache></c:numRef></c:val>`
}

function textLook(size: number, bold: boolean): string {
  return `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${String(size)}" b="${bold ? "1" : "0"}">${ink}</a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`
}

export function chartLabelsXml(chart: ChartValue): string {
  if (chart.labels === undefined) return ""
  const share = chart.kind === "pie" && chart.labels.includes("%")
  const position = chart.kind === "pie" ? "bestFit" : chart.kind === "line" ? "t" : "outEnd"
  const shown = (on: boolean) => (on ? "1" : "0")
  return `<c:dLbls><c:numFmt formatCode="${xmlAttribute(chart.labels)}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${textLook(labelSize, false)}<c:dLblPos val="${position}"/><c:showLegendKey val="0"/><c:showVal val="${shown(!share)}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${shown(share)}"/><c:showBubbleSize val="0"/></c:dLbls>`
}

function barSeries(chart: ChartValue): string {
  return chart.series
    .map((series, at) => {
      const cells = cellsOf(chart, at)
      return `<c:ser>${named(series, at, cells)}<c:spPr>${seriesFillXml(series, at)}</c:spPr><c:invertIfNegative val="0"/>${chartLabelsXml(chart)}${data(chart, series, cells)}</c:ser>`
    })
    .join("")
}

function lineSeries(chart: ChartValue): string {
  return chart.series
    .map((series, at) => {
      const cells = cellsOf(chart, at)
      return `<c:ser>${named(series, at, cells)}<c:spPr><a:ln w="${String(chartLineWidth)}" cap="rnd">${seriesFillXml(series, at)}<a:round/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>${chartLabelsXml(chart)}${data(chart, series, cells)}<c:smooth val="0"/></c:ser>`
    })
    .join("")
}

function pieSeries(chart: ChartValue): string {
  const [series] = chart.series
  if (series === undefined) return ""
  const slices = chart.categories
    .map(
      (_, at) =>
        `<c:dPt><c:idx val="${String(at)}"/><c:bubble3D val="0"/><c:spPr>${accent(at)}<a:ln w="12700"><a:solidFill><a:schemeClr val="bg1"/></a:solidFill></a:ln></c:spPr></c:dPt>`,
    )
    .join("")
  return `<c:ser>${named(series, 0, cellsOf(chart, 0))}${slices}${chartLabelsXml(chart)}${data(chart, series, cellsOf(chart, 0))}</c:ser>`
}

function axesXml(chart: ChartValue): string {
  const gridlines = chart.gridlines === false ? "" : chartGridlinesXml
  const hidden = chart.axis === false ? "1" : "0"
  return (
    `<c:catAx><c:axId val="111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr>${quiet}</c:spPr><c:crossAx val="222"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
    `<c:valAx><c:axId val="222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${hidden}"/><c:axPos val="l"/>${gridlines}<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr><c:crossAx val="111"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`
  )
}

const axisIds = '<c:axId val="111"/><c:axId val="222"/>'

function plot(chart: ChartValue): string {
  if (chart.kind === "pie")
    return `<c:pieChart><c:varyColors val="1"/>${pieSeries(chart)}<c:firstSliceAng val="0"/></c:pieChart>`
  if (chart.kind === "line")
    return `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${lineSeries(chart)}<c:marker val="1"/>${axisIds}</c:lineChart>${axesXml(chart)}`
  return `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${barSeries(chart)}<c:gapWidth val="${String(chart.gap ?? chartGap)}"/>${axisIds}</c:barChart>${axesXml(chart)}`
}

function titleXml(chart: ChartValue): string {
  if (chart.title === undefined || chart.title === "") return '<c:autoTitleDeleted val="1"/>'
  const look = `sz="${String(titleSize)}" b="1"`
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr ${look}>${ink}</a:defRPr></a:pPr><a:r><a:rPr lang="en-US" ${look}>${ink}</a:rPr><a:t>${xmlText(chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
}

function legendXml(chart: ChartValue): string {
  const place = chartLegend(chart)
  return place === null ? "" : `<c:legend><c:legendPos val="${legendPlaces[place]}"/><c:overlay val="0"/></c:legend>`
}

export function chartSpaceXml(chart: ChartValue, workbook: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<c:chartSpace ${chartNamespaces}><c:roundedCorners val="0"/><c:chart>${titleXml(chart)}<c:plotArea><c:layout/>${plot(chart)}</c:plotArea>` +
    `${legendXml(chart)}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
    `<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${textLook(1200, false)}<c:externalData r:id="${workbook}"><c:autoUpdate val="0"/></c:externalData></c:chartSpace>`
  )
}
