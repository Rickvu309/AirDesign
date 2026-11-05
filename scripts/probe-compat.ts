import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { runTextSpanProbe } from "../packages/contract-rules/src/text-span-probe.ts"
import { performanceBudgets } from "../packages/contract-rules/src/budgets.ts"

const fixtureArg = readFlag("--fixture")
const outputArg = readFlag("--output")
if (!fixtureArg || !outputArg) {
  process.stderr.write("probe:compat needs --fixture and --output\n")
  process.exit(2)
}
const report = await runTextSpanProbe(path.resolve(fixtureArg))
await mkdir(path.dirname(path.resolve(outputArg)), { recursive: true })
await writeFile(path.resolve(outputArg), `${JSON.stringify(report, null, 2)}\n`)
const withinBudget = report.wallMs <= performanceBudgets.fixtureCliWallMs && report.peakRssBytes <= performanceBudgets.fixtureCliPeakRssBytes
if (!report.unchangedPartHashesMatch || report.lineCountDelta !== 0 || report.repairPrompt !== false || report.changedParts.length !== 1 || !withinBudget) {
  process.stderr.write(`${JSON.stringify(report)}\n`)
  process.exit(1)
}

function readFlag(name: string): string | null {
  const index = process.argv.indexOf(name)
  if (index < 0) {
    return null
  }
  return process.argv[index + 1] ?? null
}
