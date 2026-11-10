import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { stampChecked, workingTree } from "./checked.mjs"
import { takeMachineLock } from "./machine-lock.mjs"
import { timeMetric } from "./metrics.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const specCache = path.join(os.homedir(), ".cache", "airdesign", "spec-results")

export const stages = [
  [
    ["format", "pnpm", ["exec", "oxfmt", "--check"]],
    ["lint", "pnpm", ["lint"]],
    ["actionlint", "node", ["scripts/actionlint.mjs"]],
    ["test", "pnpm", ["test:unit"], { AIRDESIGN_REPLAY_ONLY: "1", AIRDESIGN_SPEC_CACHE: specCache }],
    ["tooling", "pnpm", ["test:tooling"]],
    ["bug-rule", "node", ["scripts/bug-rule.mjs"]],
    ["references", "node", ["scripts/reference-order.mjs"]],
    ["worktrees", "node", ["scripts/worktrees.mjs"]],
    ["specs", "pnpm", ["check:specs"], { AIRDESIGN_SPEC_CACHE: specCache }],
    ["browser", "pnpm", ["test:browser"]],
    ["site", "pnpm", ["--filter", "@airdesign/site...", "run", "build"]],
    ["ratchet", "node", ["scripts/ratchet.mjs", "local"]],
    ["check-regression", "node", ["scripts/check-regression.mjs", "local"]],
  ],
  [["typecheck", "pnpm", ["typecheck"]]],
  [
    ["boundaries", "pnpm", ["check:boundaries"]],
    ["build", "pnpm", ["--filter", "!@airdesign/site", "-r", "--if-present", "run", "build"]],
  ],
  [["metrics", "node", ["scripts/metrics.mjs"]]],
]

export const sideSteps = new Set(["browser", "site", "tooling"])

export const partOf = (argv) => {
  const given = argv.find((word) => word.startsWith("--part="))
  if (given === undefined) return "all"
  const part = given.slice("--part=".length)
  if (part !== "main" && part !== "side") throw new Error(`--part must be main or side, and it is ${part}.`)
  return part
}

export const localSteps = new Set(["ratchet", "check-regression"])

export const onCi = (env) => env.CI === "true" || env.CI === "1"

export const stagesFor = (part, ci = onCi(process.env)) =>
  stages
    .map((stage) => stage.filter(([name]) => !(ci && localSteps.has(name))))
    .map((stage) => stage.filter(([name]) => part === "all" || (part === "side") === sideSteps.has(name)))
    .filter((stage) => stage.length > 0)

const showOnSuccess = new Set(["bug-rule", "metrics", "specs", "worktrees", ...localSteps])
const all = process.argv.includes("--all")
const failed = []

const run = ([name, command, args, extra]) =>
  new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(command, args, {
      cwd: root,
      env: extra ? { ...process.env, ...extra } : process.env,
    })
    let output = ""
    child.stdout.on("data", (chunk) => (output += chunk))
    child.stderr.on("data", (chunk) => (output += chunk))
    const finish = (status) => {
      const seconds = ((Date.now() - started) / 1000).toFixed(1)
      if (status !== 0) {
        process.stderr.write(`${output}fail ${name} ${seconds}s\n`)
        failed.push(name)
      } else {
        process.stdout.write(`${showOnSuccess.has(name) ? output : ""}ok ${name} ${seconds}s\n`)
      }
      resolve()
    }
    child.on("error", (error) => {
      output += `${error.message}\n`
      finish(1)
    })
    child.on("close", (status) => finish(status ?? 1))
  })

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const release = await takeMachineLock()
  const checkStarted = Date.now()
  const part = partOf(process.argv)
  const checkedTree = part === "all" && !onCi(process.env) ? workingTree(root) : undefined
  const ownTemp = fs.mkdtempSync(path.join(os.tmpdir(), "check-"))
  process.env.TMPDIR = ownTemp

  for (const stage of stagesFor(part)) {
    await Promise.all(stage.map(run))
    if (failed.length > 0 && !all) break
  }

  const checkSeconds = timeMetric(root, "ci-duration", checkStarted)
  console.log(checkSeconds.line)
  if (checkSeconds.over !== undefined) console.error(checkSeconds.over)
  if (checkSeconds.fails) failed.push("ci-duration")
  fs.rmSync(ownTemp, { recursive: true, force: true })
  release()

  if (failed.length > 0) {
    console.error(`failed: ${failed.join(", ")}`)
    process.exit(1)
  }
  if (checkedTree !== undefined) {
    stampChecked(root, checkedTree)
    console.log(`checked ${checkedTree.slice(0, 8)}: a commit with exactly these files may be pushed`)
  }
}
