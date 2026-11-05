import { readFile, writeFile } from "node:fs/promises"
import { importPptx, exportPptx, patchText, moveKept, patchTableCell } from "./index.ts"
import { patchChartValues } from "./edit/chart-values.ts"
import { createNativePresentation } from "./native.ts"
const [command, inputPath, outputPath, ...args] = process.argv.slice(2)
if (!inputPath || !outputPath || !["roundtrip","patch-text","patch-table","patch-chart","move","native"].includes(command ?? "")) throw new Error("usage: roundtrip|patch-text|patch-table|patch-chart|move|native input output [arguments]")
let presentation = command === "native" ? await createNativePresentation([{ title: "Native executive deck", table: { headers: ["Metric","Value"], rows: [["Revenue","42"]] }, chart: { name: "Revenue", labels: ["Q1","Q2"], values: [21,42] }, notes: "Native speaker notes" }]) : await importPptx(await readFile(inputPath))
const [part, index, value, extra, last] = args
if (command === "patch-text") {
  if (!part || index === undefined || value === undefined || !Number.isSafeInteger(Number(index))) throw new Error("patch-arguments-required")
  presentation = patchText(presentation,part,Number(index),value)
}
if (command === "move") {
  if (!part || index === undefined || value === undefined || extra === undefined) throw new Error("move-arguments-required")
  presentation = moveKept(presentation,part,index,Number(value),Number(extra))
}
if (command === "patch-table") {
  if (!part || index === undefined || value === undefined || extra === undefined || last === undefined) throw new Error("table-arguments-required")
  presentation = patchTableCell(presentation,part,Number(index),Number(value),Number(extra),last)
}
if (command === "patch-chart") {
  if (!part || index === undefined || value === undefined) throw new Error("chart-arguments-required")
  presentation = await patchChartValues(presentation,part,Number(index),value.split(",").map(Number))
}
const output = await exportPptx(presentation)
const reimported = await importPptx(output)
await writeFile(outputPath,output)
process.stdout.write(JSON.stringify({ ...presentation.report, outputSha256: reimported.report.sourceSha256, parts: presentation.parts.size, localReimport: "passed" }) + "\n")
