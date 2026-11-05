import { importedDeck } from "../../../packages/pptx/src/import-deck.ts"
import { readFile, writeFile } from "node:fs/promises"
import { importPptx, exportPptx } from "../../../packages/pptx/src/index.ts"
try {
  const started = performance.now()
  const input = await readFile("/job/input.pptx")
  const presentation = await importPptx(input)
  const output = await exportPptx(presentation)
  await importPptx(output)
  await writeFile("/job/result.pptx", output)
  await writeFile("/job/report.json", JSON.stringify({ ...presentation.report, deck:importedDeck(presentation), workerMetrics: { wallMs: performance.now()-started, peakRssBytes: process.resourceUsage().maxRSS*1024, inputBytes: input.length, expandedBytes: [...presentation.parts.values()].reduce((total,bytes) => total+bytes.length,0), parts: presentation.parts.size } }))
} catch (error) {
  await writeFile("/job/failure.json",JSON.stringify({ code: error instanceof Error ? error.message.slice(0,200) : "import-failed" }))
  process.exitCode = 1
}
