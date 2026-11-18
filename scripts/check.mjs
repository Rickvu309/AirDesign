import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { checkSteps, onCi, partOf, shardOf } from "./check-steps.mjs"
import { stampChecked, workingTree } from "./checked.mjs"
import { failedTests } from "./failed-tests.mjs"
import { takeMachineLock } from "./machine-lock.mjs"
import { timeMetric } from "./metrics.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

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

export const runCheck = async ({ chosen, lock, run, all = false, eventName = "", tree, failedFiles = new Set() }) => {
  const failed = []
  let hung = false
  const runStep = async (step) => {
    const status = await run(step)
    if (status === "hung") {
      hung = true
      failed.push(step[0])
    } else if (status !== 0 && !checkSteps.warns(step[0], eventName)) failed.push(step[0])
  }
  const cheap = chosen.flatMap((stage) => stage.flatMap(stepsOf)).filter(([name]) => checkSteps.isPreflight(name))
  await Promise.all(cheap.map(runStep))
  if (failed.length > 0 && !all) return { failed, ranSteps: false, early: true }
  const remaining = keepSteps(chosen, ([name]) => !checkSteps.isPreflight(name))
  const release = await lock()
  let ranSteps = true
  try {
    const runLane = async (entry) => {
      for (const step of stepsOf(entry)) {
        await runStep(step)
        if (failed.includes(step[0]) && !all && !hung) return
      }
    }
    for (const [index, stage] of remaining.entries()) {
      await Promise.all(stage.map(runLane))
      if (failed.length > 0 && !all && !hung && !checkSteps.mayPush(failed, true)) {
        ranSteps = index === remaining.length - 1
        break
      }
    }
    return { failed, ranSteps }
  } finally {
    await release({
      status: failed.length === 0 ? "passed" : `failed ${failed.join(" ")}`,
      tree,
      files: failed.length === 0 || failedFiles.size === 0 ? undefined : [...failedFiles].join(" "),
    })
  }
}

const groups = new Set()

const stopGroup = (pid) => {
  try {
    process.kill(-pid, "SIGKILL")
  } catch {}
}

const stopEveryGroup = () => {
  for (const pid of groups) stopGroup(pid)
}

const stillRunning = (pid) =>
  spawnSync("ps", ["-e", "-o", "pgid=,pid=,etime=,args="], { encoding: "utf8", timeout: 1000, killSignal: "SIGKILL" })
    .stdout?.split("\n")
    .filter((line) => line.trim().split(/\s+/)[0] === String(pid))
    .map((line) => line.trim().split(/\s+/).slice(1).join(" "))
    .join("\n") ?? "process list unavailable"

const hungLine = (name, command, args, limit, running) =>
  `${name} hung: ${[command, ...args].join(" ")} did not exit within ${limit} s, so check stopped it and every process it started. Still running then (pid, elapsed, command):\n${running}\n`

const print = (text, stream) => (stream === "error" ? process.stderr : process.stdout).write(text)

export const stepRunner =
  ({ limitOf, say = print, eventName = "", failedFiles = new Set() }) =>
  ([name, command, args, extra]) =>
    new Promise((resolve) => {
      const limit = limitOf(name)
      const started = Date.now()
      const child = spawn(command, args, {
        cwd: root,
        env: extra ? { ...process.env, ...extra } : process.env,
        detached: limit !== undefined,
      })
      if (limit !== undefined && child.pid !== undefined) groups.add(child.pid)
      let output = ""
      let hung = false
      let finished = false
      child.stdout.on("data", (chunk) => (output += chunk))
      child.stderr.on("data", (chunk) => (output += chunk))
      const timer =
        limit === undefined
          ? undefined
          : setTimeout(() => {
              hung = true
              output += hungLine(name, command, args, limit, stillRunning(child.pid))
              stopGroup(child.pid)
              child.stdout.destroy()
              child.stderr.destroy()
            }, limit * 1000)
      const finish = (status) => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        if (groups.has(child.pid)) stopGroup(child.pid)
        groups.delete(child.pid)
        const seconds = ((Date.now() - started) / 1000).toFixed(1)
        if (status !== 0 || hung) {
          say(`${output}${checkSteps.warns(name, eventName) && !hung ? "warn" : "fail"} ${name} ${seconds}s\n`, "error")
        } else {
          say(`${checkSteps.showsOutput(name) ? output : ""}ok ${name} ${seconds}s\n`)
        }
        if (status !== 0) for (const test of failedTests(output)) failedFiles.add(test.file)
        const hint = checkSteps.failureHint(name)
        if (status !== 0 && hint !== undefined) say(`${hint}\n`, "error")
        resolve(hung ? "hung" : status)
      }
      child.on("error", (error) => {
        output += `${error.message}\n`
        finish(1)
      })
      child.on("close", (status) => finish(status ?? 1))
    })

export const run = stepRunner({ limitOf: (name) => checkSteps.stepLimit(name, false) })

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.on("exit", stopEveryGroup)
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
    process.once(signal, () => process.exit(128 + os.constants.signals[signal]))
  const ci = onCi(process.env)
  const eventName = process.env.GITHUB_EVENT_NAME
  const part = partOf(process.argv)
  const checkedTree = part === "all" && !onCi(process.env) ? workingTree(root) : undefined
  const ownTemp = fs.mkdtempSync(path.join(os.tmpdir(), "check-"))
  const previousTemp = process.env.TMPDIR
  process.env.TMPDIR = ownTemp
  let checkStarted
  const failedFiles = new Set()
  let result
  try {
    result = await runCheck({
      eventName,
      chosen: checkSteps.stagesFor(part, ci, shardOf(process.argv)),
      all: process.argv.includes("--all"),
      tree: checkedTree,
      failedFiles,
      run: stepRunner({ limitOf: (name) => checkSteps.stepLimit(name, ci), eventName, failedFiles }),
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
  const { failed, ranSteps, early } = result
  if (early)
    console.error(
      `failed before the line: ${failed.join(", ")}. Nothing waited for the machine; fix it and run pnpm check again.`,
    )
  if (checkStarted !== undefined) {
    const checkSeconds = timeMetric(root, "check-duration", checkStarted)
    console.log(checkSeconds.line)
    if (checkSeconds.over !== undefined) console.error(checkSeconds.over)
  }

  if (checkedTree !== undefined && checkSteps.stampable(failed, ranSteps)) {
    stampChecked(root, checkedTree)
    console.log(`checked ${checkedTree.slice(0, 8)}: a commit with exactly these files may be pushed`)
    if (failed.length > 0) console.error("Only the browser tests failed here, so ci judges them on GitHub.")
  } else if (checkedTree !== undefined && checkSteps.mayPush(failed, ranSteps)) {
    console.error(
      `NOT checked: the ${failed.find(checkSteps.rerunsAlone) ?? failed[0]} step failed, so this commit is not stamped and the push guard will refuse it. Run pnpm land --check: it reruns each failed test file alone, tells load from a fault, and stamps the commit only when every file passes alone.`,
    )
  }
  if (failed.length > 0) {
    console.error(`failed: ${failed.join(", ")}`)
    process.exit(1)
  }
}
