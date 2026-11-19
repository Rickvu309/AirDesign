import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export const metricName = "design-findings"
export const reportNames = ["screens", "states"]

const reportPattern = /^design-([a-z]+)-(\d+)-of-(\d+)\.json$/

export const reportFile = (root, name, shard) =>
  path.join(root, "test-results", `design-${name}-${shard.current}-of-${shard.total}.json`)

export function writeReport(root, name, shard, report) {
  fs.mkdirSync(path.dirname(reportFile(root, name, shard)), { recursive: true })
  fs.writeFileSync(reportFile(root, name, shard), `${JSON.stringify({ shard, ...report }, null, 2)}\n`)
}

export function gather(files) {
  const found = files
    .map((file) => file.match(reportPattern))
    .filter((match) => match !== null && reportNames.includes(match[1]))
    .map(([file, name, current, total]) => ({ file, name, current: Number(current), total: Number(total) }))
  const problems = reportNames.flatMap((name) => {
    const shards = found.filter((report) => report.name === name)
    const totals = [...new Set(shards.map((report) => report.total))].toSorted((a, b) => a - b)
    if (totals.length === 0)
      return [`No design report for ${name}. The browser tests write them; run pnpm test:browser.`]
    if (totals.length > 1)
      return [`The design reports for ${name} come from splits into ${totals.join(" and ")} shards. Run them again.`]
    return Array.from({ length: totals[0] }, (_, index) => index + 1)
      .filter((current) => !shards.some((report) => report.current === current))
      .map(
        (current) =>
          `No design report for ${name} shard ${current} of ${totals[0]}. Its design job did not finish; read its log.`,
      )
  })
  return { files: found.map((report) => report.file).toSorted(), problems }
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
    const folder = path.join(root, "test-results")
    const { files, problems } = gather(fs.existsSync(folder) ? fs.readdirSync(folder) : [])
    if (problems.length > 0) throw new Error(problems.join("\n"))
    const reports = files.map((file) => JSON.parse(fs.readFileSync(path.join(folder, file), "utf8")))
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
