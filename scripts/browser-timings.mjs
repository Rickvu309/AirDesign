import fs from "node:fs"
import path from "node:path"

export default class BrowserTimings {
  tests = []

  onBegin(config, suite) {
    this.scheduled = suite.allTests().length
    this.root = config.rootDir
    this.shard = config.shard
    this.workers = config.workers
  }

  onTestEnd(test, result) {
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
    fs.mkdirSync("test-results", { recursive: true })
    fs.writeFileSync("test-results/browser-timings.json", `${report}\n`)
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `\n<details><summary>Browser timings (milliseconds)</summary>\n\n\`\`\`json\n${report}\n\`\`\`\n</details>\n`,
      )
    }
  }
}
