import { slideExportLines } from "../slide-export.mjs"

export const chartWaterfallExportName = "exported-chart-waterfall.pptx"

const original = "blank.pptx"
const changed = ["ppt/slides/slide1.xml", "[Content_Types].xml", "ppt/slides/_rels/slide1.xml.rels"]
const chartPart = /^ppt\/charts\/chart\d+\.xml$/
const values = [100, 12, 20, 9, -14, 127]

function chartLines(pptx, exported) {
  if (exported === undefined) return ["chart waterfall export is missing"]
  const parts = [...exported.keys()].filter((part) => chartPart.test(part))
  if (parts.length !== 1) return [`chart waterfall export holds ${parts.length} chart parts`]
  const read = pptx.chartValueOf(exported.get(parts[0]))
  const lines = []
  if (read?.kind !== "waterfall") lines.push(`chart waterfall export reads back as ${read?.kind ?? "nothing"}`)
  if (JSON.stringify(read?.series[0]?.values) !== JSON.stringify(values))
    lines.push(`chart waterfall export holds ${JSON.stringify(read?.series[0]?.values)}`)
  if (JSON.stringify(read?.totals) !== "[0,5]")
    lines.push(`chart waterfall export totals ${JSON.stringify(read?.totals)}`)
  const xml = new TextDecoder().decode(exported.get(parts[0]))
  if (!/<c:ser><c:idx val="0"\/>.*?<c:spPr><a:noFill\/><\/c:spPr>/su.test(xml))
    lines.push("chart waterfall export draws its base")
  if (xml.includes('<c:dLblPos val="outEnd"/>')) lines.push("chart waterfall export labels a stack outside its bars")
  lines.push(...pptx.chartWorkbookErrors(exported).map((error) => `chart waterfall export ${error}`))
  return lines
}

export default {
  specs: ["tests/browser/chart-waterfall.spec.ts"],
  exports: [chartWaterfallExportName],
  covers: ["chart.value"],
  lines(answers) {
    const { pptx, parts } = answers
    const kept = [...(parts.get(original)?.keys() ?? [])].filter((part) => !changed.includes(part))
    const lines = slideExportLines({ ...answers, original, exported: chartWaterfallExportName, kept }).map((line) =>
      line.replace(/^slide export/, "chart waterfall export"),
    )
    lines.push(...chartLines(pptx, parts.get(chartWaterfallExportName)))
    return lines
  },
}
