import { slideExportLines } from "../slide-export.mjs"

export const chartSettingsExportName = "exported-chart-settings.pptx"

const original = "blank.pptx"
const changed = ["ppt/slides/slide1.xml", "[Content_Types].xml", "ppt/slides/_rels/slide1.xml.rels"]
const wanted = [
  "<c:title>",
  'formatCode="$#,##0.0"',
  '<c:delete val="1"/>',
  '<c:gapWidth val="40"/>',
  '<c:legendPos val="t"/>',
  '<a:srgbClr val="1F4E79"/>',
  "<c:externalData r:id=",
]

function chartLines(pptx, exported) {
  if (exported === undefined) return ["chart settings export is missing"]
  const parts = [...exported.keys()].filter((part) => /^ppt\/charts\/chart\d+\.xml$/.test(part))
  if (parts.length !== 1) return [`chart settings export holds ${parts.length} chart parts`]
  const xml = new TextDecoder().decode(exported.get(parts[0]))
  const lines = wanted.filter((text) => !xml.includes(text)).map((text) => `chart settings export lacks ${text}`)
  if (xml.includes("<c:majorGridlines>")) lines.push("chart settings export still draws gridlines")
  const read = pptx.chartValueOf(exported.get(parts[0]))
  if (read?.title !== "Revenue grows every quarter" || read.labels !== "$#,##0.0" || read.legend !== "top")
    lines.push(`chart settings export reads back as ${JSON.stringify(read)}`)
  lines.push(...pptx.chartWorkbookErrors(exported).map((error) => `chart settings export ${error}`))
  return lines
}

export default {
  specs: ["tests/browser/chart-settings.spec.ts"],
  exports: [chartSettingsExportName],
  lines(answers) {
    const { pptx, parts } = answers
    const kept = [...(parts.get(original)?.keys() ?? [])].filter((part) => !changed.includes(part))
    const lines = slideExportLines({ ...answers, original, exported: chartSettingsExportName, kept }).map((line) =>
      line.replace(/^slide export/, "chart settings export"),
    )
    lines.push(...chartLines(pptx, parts.get(chartSettingsExportName)))
    return lines
  },
}
