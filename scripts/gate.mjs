import { execFile, execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { run, runCheck } from "./check.mjs"
import { checkSteps } from "./check-steps.mjs"
import { stampChecked, workingTree } from "./checked.mjs"
import { timeMetric } from "./metrics.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const prove = ".agents/skills/verify-airdesign/bin/verify-airdesign.mjs"

export const testLimit = 40

export const packagesFor = (changed) =>
  [...new Set(changed.flatMap((file) => file.match(/^(?:apps|packages)\/[^/]+(?=\/)/)?.[0] ?? []))].sort()

export const testsFor = ({ plan, related, changed, limit = testLimit }) => {
  const unit = plan.steps.find((step) => step.kind === "unit")
  if (unit === undefined) return { files: [], ci: undefined }
  if (unit.tests !== "all" && related.length <= limit) return { files: related, ci: undefined }
  const files = related.filter((file) => changed.includes(file))
  const ci =
    unit.tests === "all"
      ? `every unit test, because ${unit.because}`
      : `${String(related.length - files.length)} more test files reach this diff`
  return { files, ci }
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

const node = (args, signal) =>
  promisify(execFile)(process.execPath, args, { cwd: root, maxBuffer: 64 * 2 ** 20, signal })

const relatedTests = async (base, folder, signal) => {
  const listed = path.join(folder, "related.json")
  await node(["node_modules/vitest/vitest.mjs", "list", "--filesOnly", `--json=${listed}`, "--changed", base], signal)
  return [...new Set(JSON.parse(fs.readFileSync(listed, "utf8")).map((entry) => path.relative(root, entry.file)))]
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
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
        const unneeded = new AbortController()
        const listing = relatedTests(base, ownTemp, unneeded.signal).then(
          (files) => ({ files }),
          (error) => ({ error }),
        )
        const plan = JSON.parse((await node([prove, "prove", "--plan", "--base", against])).stdout)
        const reached = plan.steps.some((step) => step.kind === "unit")
        if (!reached) unneeded.abort()
        const listed = reached ? await listing : { files: [] }
        if (listed.error !== undefined) throw new Error(`vitest list failed: ${listed.error.message}`)
        const related = listed.files
        const tests = testsFor({ plan, related, changed: plan.changed })
        const tooling = plan.steps.find((step) => step.kind === "tooling")?.files ?? []
        const packages = packagesFor(plan.changed)
        left = tests.ci
        console.log(
          `gate: ${String(plan.changed.length)} changed files against ${against}, chosen in ${((Date.now() - started) / 1000).toFixed(1)}s: ${String(tests.files.length)} unit test files, ${String(tooling.length)} tooling test files, ${packages.length > 0 ? `the build of ${packages.join(", ")} and what depends on them` : "no build, since nothing under apps or packages changed"}`,
        )
        selection = { base, plan, related, tests: tests.files, tooling, ci: tests.ci, limit: testLimit }
        return checkSteps.affectedGateStages({ tests: tests.files, tooling, packages })
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
          `affected report: unit reached ${report.unit.files?.length ?? "unknown (all)"}, gate plans ${gate.tests.length}, left out ${report.unit.leftOut?.length ?? "unknown"}; recorded left-out seconds ${report.unit.seconds?.leftOut.seconds.toFixed(3) ?? "unknown"} (${report.unit.seconds?.leftOut.missing ?? "unknown"} files untimed)`,
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
  console.log(
    `ci runs every step of pnpm check on GitHub${left === undefined ? "" : `, with ${left}`}, before the merge.`,
  )
  if (result.failed.length > 0) {
    console.error(`failed: ${result.failed.join(", ")}`)
    process.exit(1)
  }
}
