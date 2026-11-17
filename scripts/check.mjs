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
    ["copy-literals", "node", ["scripts/copy-literals.mjs"]],
    ["actionlint", "node", ["scripts/actionlint.mjs"]],
    [
      "test",
      "node",
      ["node_modules/vitest/vitest.mjs", "run"],
      { AIRDESIGN_REPLAY_ONLY: "1", AIRDESIGN_SPEC_CACHE: specCache },
    ],
    ["tooling", "pnpm", ["test:tooling"]],
    ["bug-rule", "node", ["scripts/bug-rule.mjs"]],
    ["file-size", "node", ["scripts/file-size.mjs"]],
    ["references", "node", ["scripts/reference-order.mjs"]],
    ["interface-width", "node", ["scripts/interface-width.mjs"]],
    ["worktrees", "node", ["scripts/worktrees.mjs"]],
    ["commit-authors", "node", ["scripts/commit-authors.mjs"]],
    ["commit-titles", "node", ["scripts/commit-titles.mjs"]],
    ["conflict-markers", "node", ["scripts/conflict-markers.mjs"]],
    ["migration-numbers", "node", ["scripts/migration-numbers.mjs"]],
    ["stale-tree", "node", ["scripts/stale-tree.mjs"]],
    ["specs", "pnpm", ["check:specs"], { AIRDESIGN_SPEC_CACHE: specCache }],
    ["spec-replays", "node", ["scripts/spec-replays.mjs"]],
    ["spec-sync", "node", ["scripts/spec-sync.mjs"]],
    ["browser", "pnpm", ["test:browser"]],
    ["boundaries", "pnpm", ["check:boundaries"]],
    [
      ["typecheck", "pnpm", ["typecheck"]],
      ["build", "pnpm", ["--filter", "!@airdesign/site", "-r", "--if-present", "run", "build"]],
      ["site", "pnpm", ["--filter", "@airdesign/site...", "run", "build"]],
    ],
    ["bar", "node", ["scripts/bar.mjs", "local"]],
  ],
  [
    ["metrics", "node", ["scripts/metrics.mjs"]],
    ["design-findings", "node", ["scripts/design-findings.mjs"]],
  ],
]

export const sideSteps = new Set(["browser", "site", "tooling", "design-findings"])

export const partOf = (argv) => {
  const given = argv.find((word) => word.startsWith("--part="))
  if (given === undefined) return "all"
  const part = given.slice("--part=".length)
  if (part !== "main" && part !== "side") throw new Error(`--part must be main or side, and it is ${part}.`)
  return part
}

export const shardOf = (argv) => {
  const given = argv.find((word) => word.startsWith("--shard="))
  if (given === undefined) return undefined
  const value = given.slice("--shard=".length)
  const [current, total] = /^[1-9]\d*\/[1-9]\d*$/.test(value) ? value.split("/").map(Number) : []
  if (current === undefined || current > total)
    throw new Error(`--shard must be a part of a whole, such as 1/3, and it is ${value}.`)
  return { current, total }
}

export const localSteps = new Set(["bar"])

export const onCi = (env) => env.CI === "true" || env.CI === "1"

const isLane = (entry) => Array.isArray(entry[0])

export const stepsOf = (entry) => (isLane(entry) ? entry : [entry])

const keepSteps = (chosen, keep) =>
  chosen
    .map((stage) =>
      stage
        .map((entry) => (isLane(entry) ? entry.filter(keep) : keep(entry) ? entry : []))
        .filter((kept) => kept.length > 0),
    )
    .filter((stage) => stage.length > 0)

const sharded =
  (shard) =>
  ([name, command, args, ...rest]) =>
    shard !== undefined && name === "browser"
      ? [name, command, [...args, `--shard=${shard.current}/${shard.total}`], ...rest]
      : [name, command, args, ...rest]

export const stagesFor = (part, ci = onCi(process.env), shard = undefined) =>
  keepSteps(
    stages,
    ([name]) =>
      !(ci && localSteps.has(name)) &&
      (part === "all" || (part === "side") === sideSteps.has(name)) &&
      (shard === undefined || shard.current === 1 || name === "browser"),
  ).map((stage) => stage.map((entry) => (isLane(entry) ? entry.map(sharded(shard)) : sharded(shard)(entry))))

export const ciOnlySteps = new Set(["browser", "design-findings"])

export const stepsToRun = (chosen, ci) => (ci ? chosen : keepSteps(chosen, ([name]) => !ciOnlySteps.has(name)))

export const judgedOnCi = new Set(["test", "browser"])

export const mayPush = (failed, ran) => ran && failed.every((name) => judgedOnCi.has(name))

export const stampable = (failed, ran) => ran && failed.every((name) => name === "browser")

export const warnSteps = new Set([
  "interface-width",
  "design-findings",
  "spec-replays",
  "spec-sync",
  "conflict-markers",
  "migration-numbers",
  "stale-tree",
  "commit-titles",
])

export const recordFailure = (failed, name, warned = warnSteps) => {
  if (warned.has(name)) return "warn"
  failed.push(name)
  return "fail"
}

const showOnSuccess = new Set(["bug-rule", "commit-authors", "lint", "metrics", "specs", "worktrees", ...localSteps])
export const preflight = ["format", "lint", "file-size", "references", "bug-rule", "commit-authors", "boundaries"]

export const runCheck = async ({ chosen, lock, run, all = false }) => {
  const failed = []
  const runStep = async (step) => {
    if ((await run(step)) !== 0) recordFailure(failed, step[0])
  }
  const cheap = chosen.flatMap((stage) => stage.flatMap(stepsOf)).filter(([name]) => preflight.includes(name))
  await Promise.all(cheap.map(runStep))
  if (failed.length > 0 && !all) {
    console.error(
      `failed before the line: ${failed.join(", ")}. Nothing waited for the machine; fix it and run pnpm check again.`,
    )
    return { failed, ranSteps: false }
  }
  const remaining = keepSteps(chosen, ([name]) => !preflight.includes(name))
  const release = await lock()
  let ranSteps = true
  try {
    const runLane = async (entry) => {
      for (const step of stepsOf(entry)) {
        await runStep(step)
        if (failed.includes(step[0]) && !all) return
      }
    }
    for (const [index, stage] of remaining.entries()) {
      await Promise.all(stage.map(runLane))
      if (failed.length > 0 && !all && !mayPush(failed, true)) {
        ranSteps = index === remaining.length - 1
        break
      }
    }
    return { failed, ranSteps }
  } finally {
    release({ status: failed.length === 0 ? "passed" : `failed ${failed.join(" ")}` })
  }
}

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
        process.stderr.write(`${output}${warnSteps.has(name) ? "warn" : "fail"} ${name} ${seconds}s\n`)
      } else {
        process.stdout.write(`${showOnSuccess.has(name) ? output : ""}ok ${name} ${seconds}s\n`)
      }
      if (status !== 0 && name === "format") console.error("Run pnpm exec oxfmt <files> and commit again.")
      resolve(status)
    }
    child.on("error", (error) => {
      output += `${error.message}\n`
      finish(1)
    })
    child.on("close", (status) => finish(status ?? 1))
  })

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const part = partOf(process.argv)
  const checkedTree = part === "all" && !onCi(process.env) ? workingTree(root) : undefined
  const ownTemp = fs.mkdtempSync(path.join(os.tmpdir(), "check-"))
  const previousTemp = process.env.TMPDIR
  process.env.TMPDIR = ownTemp
  let checkStarted
  let result
  try {
    result = await runCheck({
      chosen: stepsToRun(stagesFor(part, onCi(process.env), shardOf(process.argv)), onCi(process.env)),
      all: process.argv.includes("--all"),
      run,
      lock: async () => {
        const release = await takeMachineLock()
        checkStarted = Date.now()
        return release
      },
    })
  } finally {
    fs.rmSync(ownTemp, { recursive: true, force: true })
    if (previousTemp === undefined) delete process.env.TMPDIR
    else process.env.TMPDIR = previousTemp
  }
  const { failed, ranSteps } = result
  if (checkStarted !== undefined) {
    const checkSeconds = timeMetric(root, "check-duration", checkStarted)
    console.log(checkSeconds.line)
    if (checkSeconds.over !== undefined) console.error(checkSeconds.over)
  }

  if (checkedTree !== undefined && stampable(failed, ranSteps)) {
    stampChecked(root, checkedTree)
    console.log(`checked ${checkedTree.slice(0, 8)}: a commit with exactly these files may be pushed`)
    if (failed.length > 0) console.error("Only the browser tests failed here, so ci judges them on GitHub.")
  } else if (checkedTree !== undefined && mayPush(failed, ranSteps)) {
    console.error(
      "NOT checked: the test step failed, so this commit is not stamped and the push guard will refuse it. Run pnpm land --check: it reruns each failed test file alone, tells load from a fault, and stamps the commit only when every file passes alone.",
    )
  }
  if (failed.length > 0) {
    console.error(`failed: ${failed.join(", ")}`)
    process.exit(1)
  }
}
