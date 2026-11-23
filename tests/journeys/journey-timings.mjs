import path from "node:path"
import { onCi } from "../../scripts/check-steps.mjs"
import { keepMeasured, measuredName, measuredSeconds, narrowedRun } from "../../scripts/spec-seconds.mjs"
import { journeySecondsName } from "./journey-shards.mjs"

export default class JourneyTimings {
  onBegin(config, suite) {
    this.file = path.join(config.rootDir, measuredName(journeySecondsName))
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
    const scheduled = new Map(this.cases.map(({ title }) => [title, 1]))
    const tests = this.cases.flatMap(({ title, expectedStatus, results }) =>
      results.map(({ status, duration }) => ({ file: title, status, expectedStatus, duration })),
    )
    keepMeasured(this.file, measuredSeconds({ scheduled, tests }))
  }
}
