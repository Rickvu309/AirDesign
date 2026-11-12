import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export const metricName = "design-findings"
export const reportNames = ["screens", "states"]

export const reportFile = (root, name) => path.join(root, "test-results", `design-${name}.json`)

export function writeReport(root, name, report) {
  fs.mkdirSync(path.dirname(reportFile(root, name)), { recursive: true })
  fs.writeFileSync(reportFile(root, name), `${JSON.stringify(report, null, 2)}\n`)
}

export function judge({ reports, entries, recorded }) {
  const rows = reports.flatMap((report) => report.rows)
  const count = rows.reduce((sum, row) => sum + row.findings.length, 0)
  const used = new Set(reports.flatMap((report) => report.used))
  const problems = [
    ...reports.flatMap((report) =>
      report.failures.map((failure) => `${failure.page} was not scanned: ${failure.error}`),
    ),
    ...entries
      .filter((entry) => !used.has(entry.index))
      .map(
        (entry) =>
          `look/allow.json entry ${entry.index + 1} (${entry.page}, ${entry.detector}, ${entry.selector}) silences nothing. Remove it.`,
      ),
  ]
  if (recorded?.now !== count)
    problems.push(`${metricName} is ${count} and metrics.json says ${recorded?.now}. Record ${count} in metrics.json.`)
  const seconds = Number(reports.reduce((sum, report) => sum + report.seconds, 0).toFixed(1))
  const lines = rows
    .flatMap((row) => row.findings.map((finding) => ({ page: row.page, ...finding })))
    .sort((a, b) => a.rank - b.rank || a.page.localeCompare(b.page))
    .map(
      (finding) =>
        `rank ${finding.rank} ${finding.detector} on ${finding.page} at ${finding.selector}: ${finding.message}`,
    )
  return { count, seconds, lines, problems }
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const root = path.resolve(path.dirname(self), "..")
  try {
    const missing = reportNames.filter((name) => !fs.existsSync(reportFile(root, name)))
    if (missing.length > 0)
      throw new Error(
        `No design report for ${missing.join(" and ")}. The browser tests write them; run pnpm test:browser.`,
      )
    const reports = reportNames.map((name) => JSON.parse(fs.readFileSync(reportFile(root, name), "utf8")))
    const allow = path.join(root, ".agents/skills/verify-airdesign/look/allow.mjs")
    const { readAllow } = await import(pathToFileURL(allow).href)
    const recorded = JSON.parse(fs.readFileSync(path.join(root, "metrics.json"), "utf8"))[metricName]
    const result = judge({ reports, entries: readAllow(), recorded })
    console.log(`metric ${metricName}  now ${result.count}  goal ${recorded?.goal ?? 0}`)
    console.log(`scanning design screens and states took ${result.seconds}s inside the browser tests`)
    for (const line of result.lines) console.log(line)
    for (const line of result.problems) console.error(line)
    if (result.problems.length > 0) process.exit(1)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
