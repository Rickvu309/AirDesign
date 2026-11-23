import fs from "node:fs"
import path from "node:path"
import { designScans, onCi } from "./check-steps.mjs"
import { browserExportTag } from "./pptx-cases.mjs"
import { keepMeasured, measuredName, measuredSeconds, narrowedRun, specSecondsName } from "./spec-seconds.mjs"

const noted = ["metric", "warning"]
const scans = new Set(designScans.map((file) => path.basename(file)))

export default class BrowserTimings {
  tests = []
  exported = new Set()

  onBegin(config, suite) {
    this.scheduled = suite.allTests().length
    this.perFile = new Map()
    for (const test of suite.allTests()) {
      const file = path.relative(config.rootDir, test.location.file)
      this.perFile.set(file, (this.perFile.get(file) ?? 0) + 1)
    }
    this.root = config.rootDir
    this.shard = config.shard
    this.workers = config.workers
  }

  onTestEnd(test, result) {
    const notes = test.annotations.filter(({ type }) => noted.includes(type))
    if (test.tags.includes(browserExportTag)) this.exported.add(test.id)
    this.tests.push({
      id: test.id,
      file: path.relative(this.root, test.location.file),
      title: test.titlePath(),
      status: result.status,
      expectedStatus: test.expectedStatus,
      duration: result.duration,
      worker: result.workerIndex,
      startTime: result.startTime.toISOString(),
      retry: result.retry,
      ...(notes.length === 0 ? {} : { notes }),
    })
  }

  onEnd(result) {
    const report = JSON.stringify({
      shard: this.shard,
      workers: this.workers,
      status: result.status,
      startTime: result.startTime.toISOString(),
      duration: result.duration,
      scheduled: this.scheduled,
      tests: this.tests,
    })
    const notes = this.tests.flatMap((test) => test.notes ?? [])
    const lines = notes.filter(({ type }) => type === "metric").map(({ description }) => description)
    for (const line of lines) console.log(line)
    for (const { type, description } of notes)
      if (type === "warning")
        console.log(process.env.GITHUB_ACTIONS === "true" ? `::warning::${description}` : description)
    if (result.status === "passed" && !onCi(process.env) && !narrowedRun(process.argv)) this.measureSeconds()
    fs.mkdirSync("test-results", { recursive: true })
    fs.writeFileSync("test-results/browser-timings.json", `${report}\n`)
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `${lines.map((line) => `\n${line}\n`).join("")}\n<details><summary>Browser timings (milliseconds)</summary>\n\n\`\`\`json\n${report}\n\`\`\`\n</details>\n`,
      )
    }
  }

  measureSeconds() {
    if (!fs.existsSync(path.join(this.root, specSecondsName))) return
    const tests = this.tests
      .filter((test) => !scans.has(test.file))
      .map((test) => ({ ...test, exported: this.exported.has(test.id) }))
    if (tests.length === 0) return
    keepMeasured(
      path.join(this.root, measuredName(specSecondsName)),
      measuredSeconds({ scheduled: this.perFile, tests }),
    )
  }
}
