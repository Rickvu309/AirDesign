import { decodedXmlText, type MarkupElement } from "./element-span.js"
import { paintAttribute } from "./paint-color.js"
import type { ChartMarkup, PaintChartLook } from "./chart-markup.js"
import { chartNumber } from "./chart-number.js"

export type PaintChartPosition =
  | "center"
  | "insideEnd"
  | "insideBase"
  | "outsideEnd"
  | "above"
  | "below"
  | "left"
  | "right"

export type PaintChartLabel = {
  readonly text: string
  readonly position: PaintChartPosition
  readonly look: PaintChartLook
  readonly dx: number
  readonly dy: number
}

export type ChartLabelPoint = {
  readonly series: string
  readonly category: string
  readonly value: number | null
  readonly share: number | null
  readonly format: string
}

export type ChartLabelRules = {
  readonly pie: boolean
  readonly position: PaintChartPosition
  readonly look: PaintChartLook
}

const positions = new Map<string, PaintChartPosition>([
  ["ctr", "center"],
  ["inEnd", "insideEnd"],
  ["inBase", "insideBase"],
  ["outEnd", "outsideEnd"],
  ["bestFit", "outsideEnd"],
  ["t", "above"],
  ["b", "below"],
  ["l", "left"],
  ["r", "right"],
])
const shownKinds = ["c:showSerName", "c:showCatName", "c:showVal", "c:showPercent"] as const
const percentCode = "0%"
const lineBreak = "\n"
const listBreak = "; "

export function chartLook(markup: ChartMarkup, holder: MarkupElement | undefined, base: PaintChartLook) {
  const paragraph = markup.child(holder, "a:p")
  return markup.look(markup.child(markup.child(paragraph, "a:pPr"), "a:defRPr"), base)
}

function ownFormat(markup: ChartMarkup, holder: MarkupElement | undefined): string | null {
  const format = markup.child(holder, "c:numFmt")
  if (format === undefined) return null
  const linked = paintAttribute(format, "sourceLinked")
  const code = paintAttribute(format, "formatCode")
  return linked === "1" || linked === "true" || code === null ? null : decodedXmlText(code)
}

function rangedText(markup: ChartMarkup, holder: MarkupElement): boolean {
  return markup
    .all(markup.child(holder, "c:extLst"), "c:ext")
    .some((ext) => markup.flag(ext, "c15:showDataLabelsRange") === true)
}

function labelText(
  markup: ChartMarkup,
  holders: readonly MarkupElement[],
  point: ChartLabelPoint,
  pie: boolean,
): string | null {
  const flags = holders.find((holder) => shownKinds.some((kind) => markup.child(holder, kind) !== undefined))
  const [series, category, value, percent] = shownKinds.map((kind) => markup.flag(flags, kind) === true)
  const format = holders.map((holder) => ownFormat(markup, holder)).find((code) => code !== null) ?? point.format
  const valueText = value && point.value !== null ? chartNumber(point.value, format) : ""
  const shareText =
    percent && point.share !== null ? chartNumber(point.share, format.includes("%") ? format : percentCode) : ""
  if (valueText === null || shareText === null) return null
  const parts = [series ? point.series : "", category ? point.category : "", valueText, shareText]
  const separator = holders.map((holder) => markup.child(holder, "c:separator")).find((item) => item !== undefined)
  const joint = separator !== undefined ? markup.text(separator) : pie && category && percent ? lineBreak : listBreak
  return parts.filter((part) => part !== "").join(joint)
}

export function chartLabels(
  markup: ChartMarkup,
  holder: MarkupElement | undefined,
  points: readonly ChartLabelPoint[],
  rules: ChartLabelRules,
): readonly (PaintChartLabel | null)[] | null {
  if (holder === undefined || markup.flag(holder, "c:delete") === true) return points.map(() => null)
  if (rangedText(markup, holder)) return null
  const shared = chartLook(markup, markup.child(holder, "c:txPr"), rules.look)
  const labels: (PaintChartLabel | null)[] = []
  for (const [at, point] of points.entries()) {
    const single = markup.all(holder, "c:dLbl").find((item) => markup.number(item, "c:idx") === at)
    if (single !== undefined && markup.child(single, "c:tx") !== undefined) return null
    if (single !== undefined && markup.flag(single, "c:delete") === true) {
      labels.push(null)
      continue
    }
    const holders = single === undefined ? [holder] : [single, holder]
    const text = point.value === null ? "" : labelText(markup, holders, point, rules.pie)
    if (text === null) return null
    const placed = markup.child(markup.child(single, "c:layout"), "c:manualLayout")
    const position = holders.map((item) => markup.value(item, "c:dLblPos")).find((item) => item !== null)
    labels.push(
      text === ""
        ? null
        : {
            text,
            position: positions.get(position ?? "") ?? rules.position,
            look: single === undefined ? shared : chartLook(markup, markup.child(single, "c:txPr"), shared),
            dx: markup.number(placed, "c:x") ?? 0,
            dy: markup.number(placed, "c:y") ?? 0,
          },
    )
  }
  return labels
}
