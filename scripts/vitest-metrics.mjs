import fs from "node:fs"
import path from "node:path"
import { refreshedSpecSeconds } from "./spec-seconds.mjs"
import { testFilesByProject, unitSecondsFile } from "./unit-test-files.mjs"

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
  const measured = {}
  for (const mod of modules) {
    for (const test of mod.children.allTests()) {
      tests += 1
      if (isFault(test)) faults += 1
      Object.assign(measured, test.meta().measured)
    }
  }
  return { tests, faults, measured }
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

export const readMeasured = (root, name) => {
  const value = readRun(root).measured?.[name]
  if (typeof value !== "number")
    throw new Error(`Vitest did not measure ${name}. Run pnpm test:unit, then run this again.`)
  return value
}

export const moduleSeconds = (mod) => {
  const {
    environmentSetupDuration = 0,
    prepareDuration = 0,
    collectDuration = 0,
    setupDuration = 0,
    duration = 0,
  } = mod.diagnostic()
  return environmentSetupDuration + prepareDuration + collectDuration + setupDuration + duration
}

export const recordUnitSeconds = (root, modules) => {
  const file = path.join(root, unitSecondsFile)
  const before = fs.readFileSync(file, "utf8")
  const scheduled = new Map(modules.map((mod) => [path.relative(root, mod.moduleId), 1]))
  const tests = modules.map((mod) => ({
    file: path.relative(root, mod.moduleId),
    status: mod.state(),
    expectedStatus: "passed",
    duration: moduleSeconds(mod),
  }))
  const { seconds } = refreshedSpecSeconds({
    record: { seconds: JSON.parse(before), export: {} },
    scheduled,
    tests,
    exists: (name) => fs.existsSync(path.join(root, name)),
  })
  const after = `${JSON.stringify(seconds, null, 2)}\n`
  if (after !== before) fs.writeFileSync(file, after)
}

const wholeLocalRun = (config, modules, reason) =>
  reason === "passed" &&
  !process.env.CI &&
  config.shard === undefined &&
  modules.length === Object.values(testFilesByProject(config.root)).flat().length

export default class VitestMetrics {
  onInit(ctx) {
    this.root = ctx.config.root
    this.config = ctx.config
  }

  onTestRunEnd(modules, errors = [], reason) {
    writeRun(this.root, countRun(modules))
    console.log(
      `UNIT-SECONDS ${JSON.stringify(Object.fromEntries(modules.map((mod) => [path.relative(this.root, mod.moduleId), moduleSeconds(mod)])))}`,
    )
    try {
      if (wholeLocalRun(this.config, modules, reason)) recordUnitSeconds(this.root, modules)
    } catch (error) {
      console.error(`unit seconds not recorded: ${error.message}`)
    }
    try {
      const tests = modules.map((mod) => ({
        file: path.relative(this.root, mod.moduleId),
        status: mod.state(),
        duration: mod.diagnostic().duration,
        failures: [...mod.children.allTests()]
          .filter((test) => test.result().state === "failed")
          .map((test) => test.fullName),
      }))
      const complete =
        errors.length === 0 &&
        reason !== "interrupted" &&
        tests.every((test) => ["passed", "failed", "skipped"].includes(test.status))
      fs.mkdirSync(path.join(this.root, "test-results"), { recursive: true })
      fs.writeFileSync(
        path.join(this.root, "test-results/affected-unit-results.json"),
        `${JSON.stringify({ complete, tests })}\n`,
      )
    } catch (error) {
      console.error(`affected unit results incomplete: ${error.message}`)
    }
  }
}
