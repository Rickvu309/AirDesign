import {z} from "zod"
import {ImportProgressWriter} from "./import-progress.ts"
import {jobPath} from "./job-path.ts"
import { importedDeck, importedNativeDeck } from "../../../packages/pptx/src/import-deck.ts"
import { readFile, writeFile } from "node:fs/promises"
import { importPptx, exportPptx } from "../../../packages/pptx/src/index.ts"
const progress=new ImportProgressWriter(process.stderr)
try {
  const started = performance.now()
  const protocol=z.object({protocol:z.enum(["legacy-text-v2","paragraph-body-v3"])}).strict().parse(JSON.parse(await readFile(jobPath("text-protocol.json"),"utf8").catch(error=>{if(error instanceof Error && "code" in error && error.code==="ENOENT")return '{"protocol":"legacy-text-v2"}';throw error}))).protocol
  const input = await readFile(jobPath("input.pptx"))
  const presentation = await importPptx(input)
  const output = await exportPptx(presentation)
  await importPptx(output)
  await writeFile(jobPath("result.pptx"), output)
  await writeFile(jobPath("report.json"), JSON.stringify({ ...presentation.report, deckVersion:protocol==="paragraph-body-v3" ? 3 : 2, deck:(protocol==="paragraph-body-v3" ? importedNativeDeck : importedDeck)(presentation,value=>progress.publish({kind:"import-slides",...value})), workerMetrics: { wallMs: performance.now()-started, peakRssBytes: process.resourceUsage().maxRSS*1024, inputBytes: input.length, expandedBytes: [...presentation.parts.values()].reduce((total,bytes) => total+bytes.length,0), parts: presentation.parts.size } }))
} catch (error) {
  await writeFile(jobPath("failure.json"),JSON.stringify({ code: error instanceof Error ? error.message.slice(0,200) : "import-failed" }))
  process.exitCode = 1
}

await progress.flush()
