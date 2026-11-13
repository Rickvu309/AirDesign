import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { queueLogName, takeMachineLock, waitLine } from "./machine-lock.mjs"

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "machine-lock-"))
const module = fileURLToPath(new URL("./machine-lock.mjs", import.meta.url))
const said = []
const say = (line) => said.push(line)
const settle = () => new Promise((resolve) => setTimeout(resolve, 300))

const within = (promise, what) => {
  const timer = setTimeout(() => fail(what), 10000)
  return promise.finally(() => clearTimeout(timer))
}

const waiter = (job = "check") => {
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { takeMachineLock } from ${JSON.stringify(module)}
       const release = await takeMachineLock({ folder: ${JSON.stringify(folder)}, env: {}, poll: 50, job: ${JSON.stringify(job)} })
       console.log("started")
       process.stdin.once("data", async (word) => {
         if (String(word).startsWith("go")) await release()
         process.exit(0)
       })`,
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  )
  const seen = { out: "", err: "" }
  child.stdout.on("data", (chunk) => (seen.out += chunk))
  child.stderr.on("data", (chunk) => (seen.err += chunk))
  const until = (test, what = "a waiting check never reached its state") =>
    new Promise((resolve) => {
      const deadline = Date.now() + 10000
      const look = () => {
        if (test(seen)) return resolve()
        if (Date.now() > deadline) fail(what)
        setTimeout(look, 20)
      }
      look()
    })
  const closed = new Promise((resolve) => child.on("close", resolve))
  return { child, seen, until, closed, finish: (word = "go") => child.stdin.write(`${word}\n`) }
}
const started = (seen) => seen.out.includes("started")
const placed = (place) => (seen) => seen.err.includes(`number ${place} in line`)

const first = {}
const releaseFirst = await within(takeMachineLock({ folder, env: first, say }), "a free lock kept a check waiting")
if (said.length !== 0) fail("a free lock said it was waiting")
if (first.AIRDESIGN_MACHINE_LOCK === undefined) fail("the holder does not mark its own environment")
const inside = await takeMachineLock({ folder, env: first, say })
await inside()
const onCi = await takeMachineLock({ folder, env: { CI: "true" }, say })
await onCi()
if (said.length !== 0) fail("a check inside a check, or ci, waited for the lock")

const second = waiter()
await second.until(placed(1))
const third = waiter("pptx")
await third.until(placed(2), "a second waiting check did not say it is number 2 in line")
await settle()
if (started(second.seen) || started(third.seen)) fail("a check started while another held the machine")
await releaseFirst()
await second.until(started, "the first in line did not start when the machine freed")
await settle()
if (started(third.seen)) fail("two checks held the machine at once")
await third.until(placed(1), "a check did not move up the line")

const dead = waiter()
await dead.until(placed(2))
dead.child.kill("SIGKILL")
await dead.closed
const afterDead = waiter()
await afterDead.until(placed(2), "a dead waiter kept its place in line")

second.child.kill("SIGKILL")
await second.closed
await third.until(started, "a crashed holder kept the machine")
third.finish("exit")
await third.closed
await afterDead.until(started)
afterDead.finish()
await afterDead.closed

const log = fs
  .readFileSync(path.join(folder, queueLogName), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line))
if (!log.every((row) => typeof row.waited === "number" && typeof row.ran === "number")) {
  fail("the queue log lacks a wait or a run time")
}
if (!log.some((row) => row.job === "pptx" && row.waited > 0))
  fail("the queue log missed a job that waited and exited without releasing")
if (log.length !== 3)
  fail(`the queue log has ${log.length} rows, not one per job that held the machine and exited cleanly`)
if (!waitLine(3, 90).includes("Expect about 5 min")) fail("the expected wait does not count the checks ahead")
if (waitLine(1, undefined).includes("Expect")) fail("an empty queue log still promised a wait")

const leftover = fs.readdirSync(path.join(folder, "queue"))
if (leftover.length !== 0) fail(`the queue kept tickets: ${leftover.join(", ")}`)
fs.rmSync(folder, { recursive: true, force: true })
console.log("machine lock tests passed")
