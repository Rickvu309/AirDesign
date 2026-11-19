import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { proofPlan } from "../.agents/skills/verify-airdesign/bin/prove-plan.mjs"
import { readFacts } from "../.agents/skills/verify-airdesign/bin/prove.mjs"
import { suitesFor } from "../.agents/skills/verify-airdesign/bin/suites.mjs"
import { testFilesByProject } from "./unit-test-files.mjs"
import { toolingTests } from "./tooling-tests.mjs"

const sorted = (files) => [...new Set(files)].sort()
const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 32 * 2 ** 20 }).trim()
const unknown = (reason) => ({ reached: "all", files: null, reason, run: null, leftOut: null })
const measured = (files, timings) => ({
  seconds: files.reduce((sum, file) => sum + (timings[file] ?? 0), 0),
  recorded: files.filter((file) => timings[file] !== undefined).length,
  missing: files.filter((file) => timings[file] === undefined).length,
})
const family = (inventory, picked, reason, run = [], timings = {}) => {
  const files = picked === "all" ? inventory : sorted(picked)
  const leftOut = files.filter((file) => !run.includes(file))
  return {
    reached: picked === "all" ? "all" : files,
    files,
    reason,
    run,
    leftOut,
    seconds: {
      meaning: "summed recorded file execution, not wall time; untimed files are counted as missing",
      reached: measured(files, timings),
      run: measured(run, timings),
      leftOut: measured(leftOut, timings),
    },
  }
}
const readJson = (root, file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"))
const resultFor = (root, part) => {
  const browser = part === "browser" || part === "design"
  const report = readJson(
    root,
    browser ? "test-results/browser-timings.json" : "test-results/affected-unit-results.json",
  )
  if (!Array.isArray(report.tests)) throw new Error("missing test results")
  const tests = report.tests.map((test) => ({
    ...test,
    file: browser && !test.file.startsWith("tests/browser/") ? `tests/browser/${test.file}` : test.file,
  }))
  const failed = tests.filter((test) =>
    browser ? test.status !== "skipped" && test.status !== test.expectedStatus : test.status === "failed",
  )
  const complete = browser
    ? tests.length === report.scheduled &&
      !tests.some((test) => test.status === "interrupted") &&
      (report.status === "passed" || (report.status === "failed" && failed.length > 0))
    : report.complete === true
  return { complete, tests, failed }
}
const cachedTimings = (root) => {
  try {
    return Object.fromEntries(
      readJson(root, "test-results/affected-unit-results.json").tests.map((test) => [test.file, test.duration / 1000]),
    )
  } catch {
    return {}
  }
}
const browserTimings = (root) => {
  try {
    const timings = {}
    for (const test of readJson(root, "test-results/browser-timings.json").tests) {
      if (typeof test.duration !== "number") continue
      const file = test.file.startsWith("tests/browser/") ? test.file : `tests/browser/${test.file}`
      timings[file] = (timings[file] ?? 0) + test.duration / 1000
    }
    return timings
  } catch {
    return {}
  }
}
const vitestGraph = async (root, changed) => {
  const { createVitest } = await import("vitest/node")
  const ctx = await createVitest({ root, watch: false, run: true, reporters: [], maxWorkers: 2 })
  try {
    const specs = await ctx.specifications.globTestSpecifications()
    ctx.config.related = changed.map((file) => path.join(root, file))
    const related = (await ctx.specifications.filterTestsBySource(specs)).map((spec) =>
      path.relative(root, spec.moduleId),
    )
    return {
      files: sorted(specs.map((spec) => path.relative(root, spec.moduleId))),
      related: sorted(related),
    }
  } finally {
    await ctx.close()
  }
}

export const affectedReport = async ({ root = process.cwd(), base, head = "HEAD", gate, part } = {}) => {
  const started = performance.now()
  const report = {
    version: 1,
    complete: true,
    base,
    head,
    changed: null,
    graphHead: null,
    selectionSeconds: 0,
    scope: "report only; gate run lists are today's planned files, not proof of execution",
    limitations: [
      "Import graphs do not prove dynamic reads, directory membership or runtime dependencies.",
      "TLC prerequisites are reported by prove's model-check step; no producer is started here.",
    ],
    incomplete: [],
    unit: unknown("selection unavailable"),
    tooling: unknown("selection unavailable"),
    browser: unknown("selection unavailable"),
    design: unknown("selection unavailable"),
  }
  try {
    report.base = git(root, ["rev-parse", base])
    report.head = git(root, ["rev-parse", head])
    report.graphHead = git(root, ["rev-parse", "HEAD"])
    const changed =
      gate?.plan.changed ?? git(root, ["diff", "--name-only", "--no-renames", base, head]).split("\n").filter(Boolean)
    report.changed = changed
    if (report.graphHead !== report.head) throw new Error("requested head is not checked out; graph unavailable")
    const facts = gate ? undefined : await readFacts(root, base)
    const plan = gate?.plan ?? proofPlan({ ...facts, base: report.base, head: report.head, changed })
    const step = (kind) => plan.steps.find((step) => step.kind === kind)
    const inventory = gate
      ? { files: sorted(Object.values(testFilesByProject(root)).flat()) }
      : await vitestGraph(root, changed)
    const related = gate?.related ?? inventory.related
    const run = gate?.tests ?? (step("unit-tests")?.tests === "all" ? inventory.files : related)
    const deleted = git(root, ["diff", "--name-only", "--diff-filter=D", "--no-renames", base, head])
      .split("\n")
      .filter(Boolean)
    const gaps = changed.filter(
      (file) =>
        /\.(test|spec)\.[a-z]+$/.test(file) &&
        !inventory.files.includes(file) &&
        !file.startsWith("scripts/") &&
        !file.startsWith("tests/browser/") &&
        !file.startsWith("tests/journeys/"),
    )
    const unknownInput = changed.find(
      (file) =>
        file.startsWith("scripts/") ||
        file.startsWith("specs/") ||
        !/\.(ts|tsx|mts|mjs|js)$/.test(file) ||
        (!/^tests\/browser\//.test(file) &&
          !proofPlan({ changed: [file] }).steps.some((step) => step.kind === "unit-tests")),
    )
    const broad = deleted[0]
      ? `base-side deletion or rename: ${deleted[0]}`
      : gaps[0]
        ? `test discovery gap: ${gaps[0]}`
        : unknownInput
          ? `input outside a resolved import graph: ${unknownInput}`
          : step("unit-tests")?.tests === "all"
            ? step("unit-tests").because
            : undefined
    const picked = broad ? "all" : sorted([...related, ...changed.filter((file) => inventory.files.includes(file))])
    report.unit = {
      ...family(inventory.files, picked, broad ?? "Vitest graph and added tests", run, cachedTimings(root)),
    }
    report.unit.prerequisites = plan.steps.filter((step) => step.kind === "model-check")
    const tooling = toolingTests(root)
    const toolingRun = gate?.tooling ?? step("script-tests")?.files ?? []
    report.tooling = {
      ...family(tooling, changed.length ? "all" : [], "tooling reads repository files outside imports", toolingRun),
      knownReached: toolingRun,
    }
    if (gate) {
      report.browser = unknown("computed only on ci to keep gate selection bounded")
      report.design = unknown("computed only on ci to keep gate selection bounded")
      report.incomplete.push("browser and design selection deferred to ci")
    } else {
      const browserFiles = Object.keys(facts.browser)
        .filter((file) => file.endsWith(".spec.ts"))
        .sort()
      const browserHit = suitesFor(changed, facts.rules).some((suite) => suite.name === "browser-tests")
      const browserOnly = changed.every((file) => /^tests\/browser\/[^/]+\.(ts|mts)$/.test(file))
      const browserUnknown = Object.entries(facts.browser).some(([file, imports]) => {
        const text = fs.readFileSync(path.join(root, file), "utf8")
        return (
          /\bfrom\s*'|\bimport\s*(?:["']|\((?!\s*"))|\brequire\s*\(/.test(text) ||
          imports.some((file) => file.startsWith("tests/browser/") && !fs.existsSync(path.join(root, file)))
        )
      })
      const browserAll = deleted.length > 0 || unknownInput || browserUnknown || (changed.length > 0 && !browserOnly)
      report.browser = family(
        browserFiles,
        browserAll ? "all" : (step("browser-tests")?.specs ?? []),
        browserAll
          ? browserHit
            ? "browser suite inputs"
            : "unresolved browser dependencies or base/head edges"
          : "prove browser import graph",
        [],
        browserTimings(root),
      )
      const lookOnly = changed.every(
        (file) => /^apps\/web\/src\//.test(file) || /\/look\/states\/[^/]+\.mjs$/.test(file),
      )
      report.design = family(
        facts.states.map((state) => state.name).sort(),
        lookOnly && !deleted.length ? (step("look")?.states ?? []) : changed.length ? "all" : [],
        lookOnly ? "prove look state areas" : "design inputs outside known look state areas",
      )
    }
  } catch (error) {
    report.incomplete.push(`selection: ${error.message}`)
  }
  if (part) {
    try {
      const results = resultFor(root, part)
      if (!results.complete) report.incomplete.push(`${part}: run did not finish every recorded test`)
      report.failures = results.failed.flatMap((test) => {
        const family = part === "source" ? "unit" : "browser"
        const reached = report[family]
        return (test.failures?.length ? test.failures : [test.title ?? null]).map((title) => ({
          ...test,
          title,
          family,
          insideReached: reached.files === null ? null : reached.reached === "all" || reached.files.includes(test.file),
        }))
      })
    } catch (error) {
      report.failures = null
      report.incomplete.push(`results: ${error.message}`)
    }
  }
  report.complete = report.incomplete.length === 0
  report.selectionSeconds = (performance.now() - started) / 1000
  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flag = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined)
  const output = flag("--output")
  try {
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(
      output,
      `${JSON.stringify({ complete: false, unit: unknown("selection unfinished"), tooling: unknown("selection unfinished"), browser: unknown("selection unfinished"), design: unknown("selection unfinished"), failures: null, incomplete: ["report did not finish"] })}\n`,
    )
  } catch {}
  const report = await affectedReport({ base: flag("--base"), head: flag("--head"), part: flag("--part") })
  try {
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, `${JSON.stringify(report)}\n`)
    console.log(
      `affected report: ${report.complete ? "complete" : "incomplete"}, selection ${report.selectionSeconds.toFixed(3)}s`,
    )
  } catch (error) {
    console.error(`affected report incomplete: ${error.message}`)
  }
}
