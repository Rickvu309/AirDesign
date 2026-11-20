import fs from "node:fs"
import path from "node:path"
import { onCi } from "../../scripts/check-steps.mjs"
import { narrowedRun, refreshedSpecSeconds } from "../../scripts/spec-seconds.mjs"
import { journeySecondsName } from "./journey-shards.mjs"

export default class JourneyTimings {
  onBegin(config, suite) {
    this.file = path.join(config.rootDir, journeySecondsName)
    this.cases = suite.allTests()
  }

  onEnd({ status }) {
    if (
      status !== "passed" ||
      onCi(process.env) ||
      process.env.JOURNEYS_CHANGED ||
      process.env.JOURNEYS_SHARD ||
      narrowedRun(process.argv)
    )
      return
    const before = fs.readFileSync(this.file, "utf8")
    const scheduled = new Map(this.cases.map(({ title }) => [title, 1]))
    const tests = this.cases.flatMap(({ title, expectedStatus, results }) =>
      results.map(({ status, duration }) => ({ file: title, status, expectedStatus, duration })),
    )
    const { seconds } = refreshedSpecSeconds({
      record: { seconds: JSON.parse(before), export: {} },
      scheduled,
      tests,
      exists: (name) => scheduled.has(name),
    })
    const after = `${JSON.stringify(seconds, null, 2)}\n`
    if (after !== before) fs.writeFileSync(this.file, after)
  }
}
