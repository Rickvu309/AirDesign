import { slideExportLines } from "../slide-export.mjs"

export const chartTypesExportName = "exported-chart-types.pptx"

const original = "blank.pptx"
const changed = ["ppt/slides/slide1.xml", "[Content_Types].xml", "ppt/slides/_rels/slide1.xml.rels"]
const chartPart = /^ppt\/charts\/chart\d+\.xml$/
const kinds = ["horizontal", "stacked", "stacked100"]
const stackedLabels = '<c:dLblPos val="ctr"/>'

function chartLines(pptx, exported) {
  if (exported === undefined) return ["chart types export is missing"]
  const parts = [...exported.keys()].filter((part) => chartPart.test(part))
  const read = parts.map((part) => pptx.chartValueOf(exported.get(part)))
  const found = read.map((value) => value?.kind ?? "unread").sort()
  const lines = found.join() === kinds.join() ? [] : [`chart types export reads back as ${found.join(", ")}`]
  for (const [at, part] of parts.entries()) {
    const xml = new TextDecoder().decode(exported.get(part))
    const value = read[at]
    if (value?.kind === "stacked" && (!xml.includes(stackedLabels) || xml.includes('<c:dLblPos val="outEnd"/>')))
      lines.push(`chart types export ${part} does not label its stack inside the bars`)
    if (value?.kind === "horizontal" && !xml.includes('<c:orientation val="maxMin"/>'))
      lines.push(`chart types export ${part} lists its first category at the bottom`)
  }
  lines.push(...pptx.chartWorkbookErrors(exported).map((error) => `chart types export ${error}`))
  return lines
}

export default {
  specs: ["tests/browser/chart-types.spec.ts"],
  exports: [chartTypesExportName],
  covers: ["chart.value"],
  lines(answers) {
    const { pptx, parts } = answers
    const kept = [...(parts.get(original)?.keys() ?? [])].filter((part) => !changed.includes(part))
    const lines = slideExportLines({ ...answers, original, exported: chartTypesExportName, kept }).map((line) =>
      line.replace(/^slide export/, "chart types export"),
    )
    lines.push(...chartLines(pptx, parts.get(chartTypesExportName)))
    return lines
  },
}
