import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { runCheck, stepRunner } from "./check.mjs"
import { checkSteps } from "./check-steps.mjs"
import { takeMachineLock } from "./machine-lock.mjs"

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const within = (promise, seconds, what) => {
  const timer = setTimeout(() => fail(what), seconds * 1000)
  return promise.finally(() => clearTimeout(timer))
}

const gone = (pid) => {
  try {
    process.kill(pid, 0)
  } catch {
    return true
  }
  try {
    return fs.readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].startsWith("Z")
  } catch {
    return true
  }
}

const waitGone = async (pid) => {
  const deadline = Date.now() + 3000
  while (!gone(pid) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50))
  return gone(pid)
}

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "check-hung-"))
process.on("exit", () => fs.rmSync(folder, { recursive: true, force: true }))

const oneSlot = () => ({ AIRDESIGN_CHECK_SLOTS: "1" })
const lock = () => takeMachineLock({ folder, env: oneSlot(), say: () => {} })
const node = (name, code) => [name, process.execPath, ["-e", code]]
const forever = "setInterval(() => {}, 1000)"

const killed = []
const killedStatus = await within(
  stepRunner({
    limitOf: () => 5,
    live: true,
    say: (line) => {
      killed.push(line)
      const pid = Number(/slide-grid is running in (\d+)\n/.exec(line)?.[1])
      if (pid && killed[0]?.startsWith("start browser-tests")) process.kill(pid, "SIGKILL")
    },
  })(node("browser-tests", 'console.log("slide-grid is running in " + process.pid); ' + forever)),
  15,
  "check never reported the killed browser step",
)
const killedReport = killed.join("")
if (
  killedStatus !== 1 ||
  !/start browser-tests[^]*slide-grid is running in \d+\n[^]*SIGKILL[^]*fail browser-tests/.test(killedReport)
) {
  fail(`check must print step output while the child still runs and name the signal that killed it:\n${killedReport}`)
}

const stuck = `const { spawn } = require("node:child_process")
const left = spawn(process.execPath, ["-e", ${JSON.stringify(forever)}], { stdio: "inherit" })
console.log("left behind " + left.pid)
process.exit(0)`

const printed = []
const say = (line) => printed.push(line)
const result = await within(
  runCheck({
    chosen: [[[node("stuck", stuck), node("after-stuck", "")], node("beside", "")]],
    lock,
    run: stepRunner({ limitOf: (name) => (name === "stuck" ? 1 : 10), say }),
  }),
  20,
  "check still waits on a step whose child never exits, so it would hold its slot forever",
)

if (result.failed.join() !== "stuck") fail(`only the stuck step fails by its limit, and check failed ${result.failed}`)
const report = printed.join("")
if (!report.includes(`stuck hung: ${process.execPath} -e`) || !report.includes("did not exit within 1 s"))
  fail(`the failure does not name the command or say it hung:\n${report}`)
for (const name of ["after-stuck", "beside"]) {
  if (!report.includes(`ok ${name} `)) fail(`check did not go on to run ${name} after the stuck step:\n${report}`)
}
const leftBehind = Number(/left behind (\d+)/.exec(report)?.[1])
if (!leftBehind) fail(`the stuck step's output is lost:\n${report}`)
if (!report.includes("setInterval")) fail(`the failure does not list what was still running:\n${report}`)
if (!(await waitGone(leftBehind))) fail("the limit stopped the step but left the process it started running")

const next = []
await within(
  takeMachineLock({ folder, env: oneSlot(), poll: 50, say: (line) => next.push(line) }).then((free) => free()),
  5,
  "its slot is still held after the hung step failed",
)
if (next.length > 0) fail(`the next check waited for a slot: ${next.join(" ")}`)

for (const name of ["browser-build", "browser-tests", "unit-tests", "lint"]) {
  const limit = checkSteps.stepLimit(name, true)
  if (!Number.isFinite(limit) || limit >= 30 * 60)
    fail(`${name} must diagnose its timeout before the ci job's 30-minute limit`)
}
if (checkSteps.stepLimit("unit-tests", false) < 600 || checkSteps.stepLimit("lint", false) < 400)
  fail("a step limit is below the slowest step seen on a loaded machine: unit-tests took 430 s, the others 310 s")

let locked = false
const early = await within(
  runCheck({
    chosen: [[node("lint", forever), node("later", "")]],
    lock: () => ((locked = true), lock()),
    run: stepRunner({ limitOf: (name) => (name === "lint" ? 1 : 10), say }),
  }),
  20,
  "a hung step before the line holds check forever",
)
if (early.failed.join() !== "lint" || locked) fail("a hung step before the line fails check without waiting for a slot")

printed.length = 0
const warned = await runCheck({
  chosen: [[node("spec-drift", forever)], [node("later", "")]],
  lock,
  run: stepRunner({ limitOf: (name) => (name === "spec-drift" ? 1 : 10), say }),
})
if (warned.failed.join() !== "spec-drift") fail("a hung warning-only step must fail the check")
if (!printed.join("").includes("ok later ")) fail("a hung step must not skip later stages")

const missing = []
await stepRunner({ limitOf: () => 1, say: (line) => missing.push(line) })(["missing", path.join(folder, "missing"), []])
if (missing.length !== 1) fail("a spawn error must report one failure")

const orphanFile = path.join(folder, "orphan")
const orphan = `const { spawn } = require("node:child_process")
const child = spawn(process.execPath, ["-e", ${JSON.stringify(forever)}], { stdio: "ignore" })
require("node:fs").writeFileSync(${JSON.stringify(orphanFile)}, String(child.pid))
child.unref()`
await stepRunner({ limitOf: () => 10, say: () => {} })(node("orphan", orphan))
const orphanPid = Number(fs.readFileSync(orphanFile, "utf8"))
if (!(await waitGone(orphanPid))) {
  process.kill(orphanPid, "SIGKILL")
  fail("a completed step left its child running without a time limit")
}
