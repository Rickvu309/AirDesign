import type { ChartValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { chartValueOf } from "./chart-read.js"
import { chartWorkbookErrors } from "./chart-workbook-check.js"
import { chartPartOf, writeChart } from "./chart-write.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readPackage, readShapes } from "./index.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const officeTitle = "Revenue by region"

type Change = { readonly [Key in keyof ChartValue]?: ChartValue[Key] | undefined }

function withChange(chart: ChartValue, change: Change): ChartValue {
  const merged = Object.entries({ ...chart, ...change }).filter(([, value]) => value !== undefined)
  return Object.fromEntries(merged) as ChartValue
}

async function deckChart(deck: string, shapeAt = 0) {
  const file = process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${deck}`)
  const read = await readPackage(file)
  if (!read.ok) throw new Error(deck)
  const shape = readShapes(read.parts).filter((each) => each.contentKind === "chart")[shapeAt]
  if (shape === undefined) throw new Error("chart")
  const chartPart = chartPartOf(read.parts, shape.part, shape.shape)
  const chart = chartValueOf(read.parts.get(chartPart)!)
  if (chart === null) throw new Error("value")
  const edit = (change: Change) => {
    const next = writeChart(read.parts, shape.part, shape.shape, withChange(chart, change))
    const changed = [...next.keys()].filter((name) => next.get(name) !== read.parts.get(name))
    return { before: decodeUtf8(read.parts.get(chartPart)!), after: decodeUtf8(next.get(chartPart)!), next, changed }
  }
  return { chart, chartPart, edit, parts: read.parts, shape }
}

const office = () => deckChart("office-chart.pptx")
const officeLine = () => deckChart("office-chart.pptx", 1)
const censusPie = () => deckChart("census-updating-spm.pptx")

it("reads the PowerPoint column chart the tests edit", async () => {
  const { chart } = await office()
  expect(chart).toEqual({
    kind: "bar",
    categories: ["North", "South", "West"],
    series: [
      { name: "2024", values: [4.3, 2.5, 3.5] },
      { name: "2025", values: [2.4, 4.4, 1.8] },
    ],
    title: officeTitle,
    gap: 219,
  })
})

it("changes only the title's words, keeping its font, size and colour", async () => {
  const { edit, chartPart } = await office()
  const { before, after, next, changed } = edit({ title: "Revenue grew in every region" })
  expect(after).toBe(before.replace(`<a:t>${officeTitle}</a:t>`, "<a:t>Revenue grew in every region</a:t>"))
  expect(changed).toEqual([chartPart])
  expect(chartValueOf(next.get(chartPart)!)?.title).toBe("Revenue grew in every region")
})

it("removes a title, and adds one that takes the deck's font", async () => {
  const office_ = await office()
  const removed = office_.edit({ title: undefined })
  expect(removed.after).not.toContain("<c:title>")
  expect(removed.after).toContain('<c:autoTitleDeleted val="1"/>')
  expect(chartValueOf(removed.next.get(office_.chartPart)!)?.title).toBeUndefined()
  const pie = await censusPie()
  const added = pie.edit({ title: "Most homes are rented" })
  const title = /<c:title>.*?<\/c:title>/u.exec(added.after)?.[0] ?? ""
  expect(title).toContain("<a:t>Most homes are rented</a:t>")
  expect(title).not.toContain("<a:latin")
  expect(added.after.replace(title, "").replace('<c:autoTitleDeleted val="0"/>', '<c:autoTitleDeleted val="1"/>')).toBe(
    added.before,
  )
  expect(chartValueOf(added.next.get(pie.chartPart)!)?.title).toBe("Most homes are rented")
})

it("changes the gap, legend place, value axis and gridlines in place", async () => {
  const { edit, chartPart } = await office()
  const gap = edit({ gap: 60 })
  expect(gap.after).toBe(gap.before.replace('<c:gapWidth val="219"/>', '<c:gapWidth val="60"/>'))
  const legend = edit({ legend: "right" })
  expect(legend.after).toBe(legend.before.replace('<c:legendPos val="b"/>', '<c:legendPos val="r"/>'))
  const hidden = edit({ legend: "none" })
  expect(hidden.after).not.toContain("<c:legend>")
  expect(hidden.after).toContain("<c:plotVisOnly")
  const axis = edit({ axis: false })
  expect(axis.after).toBe(
    axis.before.replace(
      '<c:valAx><c:axId val="502"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/>',
      '<c:valAx><c:axId val="502"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="1"/>',
    ),
  )
  const gridlines = edit({ gridlines: false })
  expect(gridlines.after).toBe(gridlines.before.replace(/<c:majorGridlines>.*?<\/c:majorGridlines>/u, ""))
  for (const { next } of [gap, legend, hidden, axis, gridlines]) expect(chartWorkbookErrors(next)).toEqual([])
  expect(chartValueOf(axis.next.get(chartPart)!)?.axis).toBe(false)
  expect(chartValueOf(gridlines.next.get(chartPart)!)?.gridlines).toBe(false)
  expect(chartValueOf(hidden.next.get(chartPart)!)?.legend).toBe("none")
})

it("recolours one series' fill and keeps its border", async () => {
  const { chart, edit, chartPart } = await office()
  const series = chart.series.map((each, at) => (at === 1 ? { ...each, color: { rgb: "1F4E79" } } : each))
  const { before, after, next } = edit({ series })
  const second = /<c:ser><c:idx val="1"\/>.*?<\/c:ser>/u.exec(before)?.[0] ?? ""
  expect(after).toBe(
    before.replace(
      second,
      second.replace(
        '<a:solidFill><a:schemeClr val="accent2"/></a:solidFill>',
        '<a:solidFill><a:srgbClr val="1F4E79"/></a:solidFill>',
      ),
    ),
  )
  expect(chartValueOf(next.get(chartPart)!)?.series[1]?.color).toEqual({ rgb: "1F4E79" })
})

it("adds data labels to each series in the deck's font, and turns them off again", async () => {
  const { edit, chartPart } = await office()
  const on = edit({ labels: "#,##0.0" })
  expect(on.after.match(/<c:dLbls><c:numFmt formatCode="#,##0.0" sourceLinked="0"\/>/gu)).toHaveLength(2)
  expect(on.after).toContain('<c:invertIfNegative val="0"/><c:dLbls>')
  expect(on.after.match(/<a:latin/gu)?.length).toBe(on.before.match(/<a:latin/gu)?.length)
  expect(chartValueOf(on.next.get(chartPart)!)?.labels).toBe("#,##0.0")
  const pie = await censusPie()
  const shown = pie.edit({ labels: "0.0%" })
  expect(shown.after).toContain('<c:numFmt formatCode="0.0%" sourceLinked="0"/>')
  expect(shown.after).toContain('<a:latin typeface="+mn-lt"/>')
  expect(chartValueOf(shown.next.get(pie.chartPart)!)?.labels).toBe("0.0%")
  const off = pie.edit({ labels: undefined })
  expect(off.after.length).toBe(off.before.length)
  expect(off.after).not.toContain('<c:showPercent val="1"/>')
  expect(off.after).toContain("<c:leaderLines>")
  expect(chartValueOf(off.next.get(pie.chartPart)!)?.labels).toBeUndefined()
})

it("recolours a line's stroke and adds labels above its points, keeping its width", async () => {
  const { chart, edit, chartPart } = await officeLine()
  expect(chart.kind).toBe("line")
  const series = chart.series.map((each, at) => (at === 0 ? { ...each, color: { scheme: "accent6" as const } } : each))
  const { before, after, next } = edit({ series, labels: "#,##0.0" })
  const first = /<c:ser><c:idx val="0"\/>.*?<\/c:ser>/u.exec(after)?.[0] ?? ""
  expect(first).toContain(
    '<a:ln w="28575" cap="rnd"><a:solidFill><a:schemeClr val="accent6"/></a:solidFill><a:round/></a:ln>',
  )
  expect(first).toContain('<c:marker><c:symbol val="none"/></c:marker><c:dLbls>')
  expect(after.length).toBeGreaterThan(before.length)
  expect(chartValueOf(next.get(chartPart)!)).toEqual({ ...chart, series, labels: "#,##0.0" })
  expect(chartWorkbookErrors(next)).toEqual([])
})

it("leaves every byte alone when the value read from the file is written back", async () => {
  for (const load of [office, officeLine, censusPie]) {
    const { edit } = await load()
    const { before, after, changed } = edit({})
    expect(after).toBe(before)
    expect(changed).toEqual([])
  }
})

it("centres a new title where the old one had a place of its own", async () => {
  const pie = await deckChart("census-updating-spm.pptx", 3)
  expect(pie.chart.title).toBe("Residence")
  const { before, after } = pie.edit({ title: "Most people live in or near cities" })
  const title = (xml: string) => /<c:title>.*?<\/c:title>/u.exec(xml)?.[0] ?? ""
  expect(title(before)).toContain("<c:manualLayout>")
  expect(title(after)).not.toContain("<c:layout>")
  expect(title(after)).toContain('<a:defRPr sz="1862" b="0"')
  expect(after.replace(title(after), "")).toBe(before.replace(title(before), ""))
})

it("recolours one imported slice and keeps its border", async () => {
  const pie = await deckChart("census-updating-spm.pptx")
  const [series] = pie.chart.series
  if (series === undefined) throw new Error("series")
  const colors = pie.chart.categories.map((_, at) =>
    at === 0 ? { rgb: "1F4E79" } : { scheme: `accent${String(at + 1)}` },
  )
  const { before, after, next } = pie.edit({ series: [{ ...series, colors } as typeof series] })
  const slice = '<c:dPt><c:idx val="0"/><c:bubble3D val="0"/><c:spPr><a:solidFill>'
  expect(after).toBe(before.replace(`${slice}<a:schemeClr val="accent1"/>`, `${slice}<a:srgbClr val="1F4E79"/>`))
  expect(chartValueOf(next.get(pie.chartPart)!)?.series[0]?.colors?.[0]).toEqual({ rgb: "1F4E79" })
})

it("adds axis titles in the axis's own font and colour, rewords them, and removes them back to the file's bytes", async () => {
  const { chart, edit, chartPart, parts, shape } = await office()
  const added = edit({ valueTitle: "Revenue ($M)", categoryTitle: "Region" })
  const value = /<c:valAx>.*?<\/c:valAx>/u.exec(added.after)?.[0] ?? ""
  expect(value).toContain("</c:majorGridlines><c:title>")
  expect(value).toContain('<a:bodyPr rot="-5400000" vert="horz"/>')
  expect(/<c:title>.*?<\/c:title>/u.exec(value)?.[0]).toContain('sz="1197"')
  expect(/<c:title>.*?<\/c:title>/u.exec(value)?.[0]).toContain('<a:latin typeface="Georgia"/>')
  expect(/<c:catAx>.*?<\/c:catAx>/u.exec(added.after)?.[0]).toContain('<c:axPos val="b"/><c:title>')
  const read = chartValueOf(added.next.get(chartPart)!)
  expect([read?.valueTitle, read?.categoryTitle]).toEqual(["Revenue ($M)", "Region"])
  const titled = { ...chart, valueTitle: "Revenue ($M)", categoryTitle: "Region" }
  const reworded = writeChart(added.next, shape.part, shape.shape, { ...titled, valueTitle: "Sales ($M)" })
  expect(decodeUtf8(reworded.get(chartPart)!)).toBe(added.after.replace("Revenue ($M)", "Sales ($M)"))
  const cleared = writeChart(added.next, shape.part, shape.shape, chart)
  expect(decodeUtf8(cleared.get(chartPart)!)).toBe(decodeUtf8(parts.get(chartPart)!))
})
