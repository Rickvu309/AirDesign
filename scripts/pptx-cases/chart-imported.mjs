import { slideExportLines } from "../slide-export.mjs"

export const chartImportedExportName = "exported-chart-imported.pptx"

const original = "census-updating-spm.pptx"

const same = (left, right) => left !== undefined && right !== undefined && Buffer.from(left).equals(Buffer.from(right))

function editedLines(pptx, before, after) {
  if (after === undefined) return ["imported chart export is missing"]
  const changed = [...after.keys()].filter(
    (name) => /^ppt\/(charts|embeddings)\//.test(name) && !same(before.get(name), after.get(name)),
  )
  const lines = []
  const charts = changed.filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name))
  const workbooks = changed.filter((name) => name.endsWith(".xlsx"))
  if (charts.length !== 1 || workbooks.length !== 1)
    lines.push(`imported chart export changed ${changed.join(", ") || "no chart part"}, not one chart and its workbook`)
  const xml = charts.length === 1 ? new TextDecoder().decode(after.get(charts[0])) : ""
  const kept = new TextDecoder().decode(before.get(charts[0]) ?? new Uint8Array())
  for (const marker of ['<c:showCatName val="1"/>', "<c:v>42</c:v>"])
    if (!xml.includes(marker)) lines.push(`imported chart export chart part lacks ${marker}`)
  if (xml.length - kept.length > 8) lines.push("imported chart export rewrote more than the edited number")
  lines.push(...pptx.chartWorkbookErrors(after).map((error) => `imported chart export ${error}`))
  return lines
}

export default {
  specs: ["tests/browser/chart-imported.spec.ts"],
  exports: [chartImportedExportName],
  lines(answers) {
    const { pptx, parts } = answers
    const before = parts.get(original)
    const after = parts.get(chartImportedExportName)
    const kept = [...(before?.keys() ?? [])].filter(
      (name) => !/^ppt\/(charts|embeddings)\//.test(name) && name !== "ppt/slides/slide19.xml",
    )
    const lines = slideExportLines({ ...answers, original, exported: chartImportedExportName, kept }).map((line) =>
      line.replace(/^slide export/, "imported chart export"),
    )
    lines.push(...editedLines(pptx, before, after))
    return lines
  },
}
