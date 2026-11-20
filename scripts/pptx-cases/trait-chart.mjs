import { slideExportLines } from "../slide-export.mjs"

export const chartToolExportName = "exported-chart-tool.pptx"

const original = "blank.pptx"
const changed = ["ppt/slides/slide1.xml", "[Content_Types].xml", "ppt/slides/_rels/slide1.xml.rels"]
const chartPart = /^ppt\/charts\/chart\d+\.xml$/
const workbookPart = /^ppt\/embeddings\/[^/]+\.xlsx$/

function chartLines(pptx, exported) {
  if (exported === undefined) return ["chart tool export is missing"]
  const frames = pptx.readShapes(exported).filter((shape) => shape.contentKind === "chart")
  const parts = [...exported.keys()].filter((part) => chartPart.test(part))
  if (frames.length !== 1 || parts.length !== 1)
    return [`chart tool export holds ${frames.length} chart frames and ${parts.length} chart parts`]
  const xml = new TextDecoder().decode(exported.get(parts[0]))
  const wanted = ["<c:lineChart>", "<c:v>Revenue</c:v>", "<c:v>7.5</c:v>", "<c:v>Q4</c:v>", "<c:externalData r:id="]
  const lines = wanted.filter((text) => !xml.includes(text)).map((text) => `chart tool export chart part lacks ${text}`)
  const workbooks = [...exported.keys()].filter((part) => workbookPart.test(part))
  if (workbooks.length !== 1) lines.push(`chart tool export holds ${workbooks.length} embedded workbooks`)
  lines.push(...pptx.chartWorkbookErrors(exported).map((error) => `chart tool export ${error}`))
  return lines
}

export default {
  specs: ["tests/browser/chart-tool.spec.ts"],
  exports: [chartToolExportName],
  covers: ["chart.value"],
  lines(answers) {
    const { pptx, parts } = answers
    const kept = [...(parts.get(original)?.keys() ?? [])].filter((part) => !changed.includes(part))
    const lines = slideExportLines({ ...answers, original, exported: chartToolExportName, kept }).map((line) =>
      line.replace(/^slide export/, "chart tool export"),
    )
    lines.push(...chartLines(pptx, parts.get(chartToolExportName)))
    return lines
  },
}
