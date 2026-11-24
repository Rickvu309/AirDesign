import { execFile, execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { requirePinnedNode } from "./node-version.cjs"
import { changeMap, readChangeGraph } from "./change-map.mjs"
import { run, runCheck } from "./check.mjs"
import { checkSteps, unitTestsIn } from "./check-steps.mjs"
import { stampChecked, workingTree } from "./checked.mjs"
import { timeMetric } from "./metrics.mjs"
import { testFilesByProject } from "./unit-test-files.mjs"
import { affectedDistances, loadWorkspace, unitOf } from "ts-packwerk"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const prove = ".agents/skills/verify-airdesign/bin/verify-airdesign.mjs"
export const unitSecondsBudget = 15
const secondsPerFile = 1

export const packagesFor = (changed) =>
  [...new Set(changed.flatMap((file) => file.match(/^(?:apps|packages)\/[^/]+(?=\/)/)?.[0] ?? []))].sort()

export const testsFor = ({ map, related, inventory, changed, seconds = {}, distance = () => 0 }) => {
  const reach = unitTestsIn(map.unitTests, inventory)
  const reached = new Set(reach)
  const weight = (file) => secondsPerFile + (seconds[file] ?? 0) / 2
  const mustRun = changed.filter((file) => reached.has(file))
  const near = map.unitTests === "all" ? [] : related.filter((file) => reached.has(file) && !mustRun.includes(file))
  const files = [...mustRun]
  let spent = files.reduce((sum, file) => sum + weight(file), 0)
  const ranked = near.toSorted((a, b) => distance(a) - distance(b) || weight(a) - weight(b) || a.localeCompare(b))
  for (const file of ranked) {
    if (spent + weight(file) > unitSecondsBudget) break
    files.push(file)
    spent += weight(file)
  }
  return { files: files.toSorted(), reach: reach.length }
}

const partNames = {
  scripts: "every script test and the site build",
  design: "the design scans (2 jobs)",
  browser: "the browser tests (4 jobs)",
  journeys: "the journeys",
  pdf: "the PDF check",
  "model-check": "the model check",
}

export const ciAlsoRuns = (map, ranUnit, reach) => [
  ...(map.everything ? [`every part, because ${map.because}`] : []),
  ...(reach > ranUnit ? [`${String(reach - ranUnit)} more unit test files the change reaches`] : []),
  ...(map.everything
    ? []
    : Object.entries(partNames)
        .filter(([part]) => map.parts[part])
        .map(([, name]) => name)),
]

export const recordedSeconds = (folder) => {
  const seconds = {}
  const cache = path.join(folder, "node_modules/.vite/vitest")
  if (!fs.existsSync(cache)) return seconds
  for (const entry of fs.readdirSync(cache)) {
    const file = path.join(cache, entry, "results.json")
    if (!fs.existsSync(file)) continue
    try {
      for (const project of Object.values(JSON.parse(fs.readFileSync(file, "utf8")).projects ?? {}))
        for (const [test, result] of Object.entries(project.files ?? {}))
          if (typeof result?.duration === "number") seconds[test] = Math.max(seconds[test] ?? 0, result.duration / 1000)
    } catch {}
  }
  return seconds
}

const noLine = async () => () => {}

export const runGate = async ({
  later,
  run: runStep,
  stamp,
  all = false,
  cheap = checkSteps.cheapGateStages(),
  report = async () => {},
}) => {
  const choosing = later().then(
    (chosen) => ({ chosen }),
    (error) => ({ error }),
  )
  const first = await runCheck({ chosen: cheap, run: runStep, all, lock: noLine })
  if (first.failed.length > 0 && !all) return first
  const picked = await choosing
  if (picked.error !== undefined) throw picked.error
  try {
    await report()
  } catch (error) {
    console.error(`affected report incomplete: ${error.message}`)
  }
  const second = await runCheck({ chosen: picked.chosen, run: runStep, all, lock: noLine })
  const failed = [...first.failed, ...second.failed]
  const ranSteps = first.ranSteps && second.ranSteps
  if (checkSteps.stampable(failed, ranSteps)) stamp()
  return { failed, ranSteps }
}

const node = (args) => promisify(execFile)(process.execPath, args, { cwd: root, maxBuffer: 64 * 2 ** 20 })

const relatedTests = async (base, folder) => {
  const listed = path.join(folder, "related.json")
  await node(["node_modules/vitest/vitest.mjs", "list", "--filesOnly", `--json=${listed}`, "--changed", base])
  return [...new Set(JSON.parse(fs.readFileSync(listed, "utf8")).map((entry) => path.relative(root, entry.file)))]
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  requirePinnedNode()
  const started = Date.now()
  const at = process.argv.indexOf("--base")
  const against = at === -1 ? "origin/main" : process.argv[at + 1]
  const tree = workingTree(root)
  const ownTemp = fs.mkdtempSync(path.join(os.tmpdir(), "gate-"))
  const previousTemp = process.env.TMPDIR
  process.env.TMPDIR = ownTemp
  let left
  let result
  let selection
  try {
    result = await runGate({
      all: process.argv.includes("--all"),
      run,
      later: async () => {
        const base = execFileSync("git", ["merge-base", against, "HEAD"], { cwd: root, encoding: "utf8" }).trim()
        const plan = JSON.parse((await node([prove, "prove", "--plan", "--base", against])).stdout)
        const map = changeMap(plan.changed, readChangeGraph(root))
        const inventory = Object.values(testFilesByProject(root)).flat().sort()
        const related = map.unitTests === "all" || map.unitTests.length === 0 ? [] : await relatedTests(base, ownTemp)
        const workspace = await loadWorkspace(root)
        const distances = affectedDistances(workspace, plan.changed)
        const { files: tests, reach } = testsFor({
          map,
          related,
          inventory,
          changed: plan.changed,
          seconds: recordedSeconds(root),
          distance: (file) => distances.get(unitOf(workspace, file) ?? "") ?? Number.POSITIVE_INFINITY,
        })
        left = ciAlsoRuns(map, tests.length, reach)
        const tooling = map.parts.scripts ? (plan.steps.find((step) => step.kind === "script-tests")?.files ?? []) : []
        const packages = packagesFor(plan.changed)
        console.log(
          `gate: ${String(plan.changed.length)} changed files against ${against}, chosen in ${((Date.now() - started) / 1000).toFixed(1)}s by scripts/change-map.mjs, the map ci uses, nearest pack first by ts-packwerk affected: ${String(tests.length)} of the ${String(reach)} unit test files the change reaches, ${String(tooling.length)} script test files, ${packages.length > 0 ? `the build of ${packages.join(", ")} and what depends on them` : "no build, since nothing under apps or packages changed"}`,
        )
        selection = { base, plan, related, tests, tooling }
        return checkSteps.affectedGateStages({ tests, tooling, packages })
      },
      report: async () => {
        const started = performance.now()
        const { affectedReport } = await import("./affected-report.mjs")
        const { base, ...gate } = selection
        const report = await affectedReport({ root, base, gate })
        const folder = path.resolve(
          root,
          execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: root, encoding: "utf8" }).trim(),
          "airdesign-checked",
        )
        fs.mkdirSync(folder, { recursive: true })
        fs.writeFileSync(path.join(folder, `${tree}.affected-report.json`), `${JSON.stringify(report)}\n`)
        console.log(
          `affected report: possible unit reach ${report.unit.files?.length ?? "unknown (all)"}, gate plans ${gate.tests.length}, outside gate ${report.unit.leftOut?.length ?? "unknown"}; recorded left-out seconds ${report.unit.seconds?.leftOut.seconds.toFixed(3) ?? "unknown"} (${report.unit.seconds?.leftOut.missing ?? "unknown"} files untimed)`,
        )
        console.log(
          `affected report: added ${((performance.now() - started) / 1000).toFixed(3)}s; browser and design computed only on ci; ${report.complete ? "complete" : "incomplete"}`,
        )
      },
      stamp: () => {
        stampChecked(root, tree)
        console.log(`gate passed ${tree.slice(0, 8)}: a commit with exactly these files may be pushed`)
      },
    })
  } catch (error) {
    console.error(`the gate could not plan what to run: ${error.message}`)
    result = { failed: ["plan"] }
  } finally {
    fs.rmSync(ownTemp, { recursive: true, force: true })
    if (previousTemp === undefined) delete process.env.TMPDIR
    else process.env.TMPDIR = previousTemp
  }
  const seconds = timeMetric(root, "gate-duration", started)
  console.log(seconds.line)
  if (seconds.over !== undefined) console.error(seconds.over)
  if (left !== undefined)
    console.log(left.length === 0 ? "CI will also run: nothing more" : `CI will also run: ${left.join(", ")}`)
  if (result.failed.length > 0) {
    console.error(`failed: ${result.failed.join(", ")}`)
    process.exit(1)
  }
}
