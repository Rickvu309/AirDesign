import fs from "node:fs"
import path from "node:path"

export const resultFile = (root) => path.join(root, "node_modules/.cache/vitest-metrics.json")

export const isFault = (test) => {
  const result = test.result()
  if (result.state === "skipped" || result.state === "pending") return true
  if (test.options?.fails === true) return true
  if (result.state !== "passed") return false
  const assertions = test.meta().assertions
  return assertions === 0 || assertions === undefined
}

export const countRun = (modules) => {
  let tests = 0
  let faults = 0
  for (const mod of modules) {
    for (const test of mod.children.allTests()) {
      tests += 1
      if (isFault(test)) faults += 1
    }
  }
  return { tests, faults }
}

export const writeRun = (root, count) => {
  const file = process.env.AIRDESIGN_VITEST_METRICS ?? resultFile(root)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(count)}\n`)
}

export const readRun = (root) => {
  const file = resultFile(root)
  if (!fs.existsSync(file)) throw new Error("Vitest has not reported yet. Run pnpm test:unit, then run this again.")
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
  if (typeof parsed.tests !== "number" || typeof parsed.faults !== "number") {
    throw new Error("Vitest's result is missing tests or faults.")
  }
  return parsed
}

export default class VitestMetrics {
  onInit(ctx) {
    this.root = ctx.config.root
  }

  onTestRunEnd(modules) {
    writeRun(this.root, countRun(modules))
  }
}
