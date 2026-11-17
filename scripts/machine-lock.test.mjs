import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { checkSlots, queueLogName, recentRunSeconds, takeMachineLock, waitLine } from "./machine-lock.mjs"

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

const waiter = (job = "check", lane = "full", slots = 1) => {
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { takeMachineLock } from ${JSON.stringify(module)}
       const release = await takeMachineLock({ folder: ${JSON.stringify(folder)}, env: { AIRDESIGN_CHECK_SLOTS: "${slots}" }, poll: 50, job: ${JSON.stringify(job)}, lane: ${JSON.stringify(lane)} })
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

const first = { AIRDESIGN_CHECK_SLOTS: "1" }
const releaseFirst = await within(takeMachineLock({ folder, env: first, say }), "a free lock kept a check waiting")
if (said.length !== 0) fail("a free lock said it was waiting")
if (first.AIRDESIGN_MACHINE_LOCK === undefined) fail("the holder does not mark its own environment")
const inside = await takeMachineLock({ folder, env: first, say })
await inside()
const onCi = await takeMachineLock({ folder, env: { CI: "true" }, say })
await onCi()
if (said.length !== 0) fail("a check inside a check, or ci, waited for the lock")

const releaseSmall = await within(
  takeMachineLock({ folder, env: {}, say, job: "rerun", lane: "small" }),
  "a small job waited while only a full check held the machine",
)
if (said.length !== 0) fail("a small job beside a full check said it was waiting")
const smallSecond = waiter("rerun", "small")
await smallSecond.until(placed(1), "a second small job did not queue behind the first")
if (!smallSecond.seen.err.includes("small lane")) fail("a waiting small job did not name its lane")
await settle()
if (started(smallSecond.seen)) fail("two small jobs ran at once")
await releaseSmall({ status: "failed" })
await smallSecond.until(started, "the next small job did not start when the small lane freed")
smallSecond.finish()
await smallSecond.closed

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
const full = log.filter((row) => row.lane === "full")
const small = log.filter((row) => row.lane === "small")
if (full.length !== 3)
  fail(`the queue log has ${full.length} full rows, not one per check that held the machine and exited cleanly`)
if (small.length !== 2) fail(`the queue log has ${small.length} small rows, not one per small job`)
if (small[0].status !== "failed" || small[1].status !== "done") fail("the queue log lacks a small job's status")
if (!log.some((row) => row.job === "pptx" && row.status === "exited"))
  fail("a job that exited without releasing is not logged as exited")
if (recentRunSeconds(path.join(folder, queueLogName), 20, "small") === undefined)
  fail("the expected wait of the small lane reads no small runs")
if (!waitLine(1, undefined, "small").includes("small lane")) fail("the small lane's wait line does not name it")
if (!waitLine(3, 90).includes("Expect about 5 min")) fail("the expected wait does not count the checks ahead")
if (waitLine(1, undefined).includes("Expect")) fail("an empty queue log still promised a wait")

const gib = 2 ** 30
if (checkSlots({}, 8, 16 * gib) !== 1) fail("a small machine ran more than one check at once")
if (checkSlots({}, 32, 16 * gib) !== 1) fail("16 GB of memory ran more than one check at once")
if (checkSlots({}, 48, 47 * gib) !== 3) fail("48 cores and 47 GB did not run three checks at once")
if (checkSlots({ AIRDESIGN_CHECK_SLOTS: "2" }, 48, 47 * gib) !== 2) fail("the owner's slot count was ignored")
if (checkSlots({ AIRDESIGN_CHECK_SLOTS: "zero" }, 8, 16 * gib) !== 1) fail("a bad slot count was not ignored")

const pairOne = waiter("check", "full", 2)
const pairTwo = waiter("check", "full", 2)
await pairOne.until(started, "the first of two slots did not start")
await pairTwo.until(started, "a second free slot kept a check waiting")
const pairThird = waiter("check", "full", 2)
await pairThird.until(placed(1), "a third check with two slots did not say it is number 1 in line")
await settle()
if (started(pairThird.seen)) fail("three checks held two slots")
pairOne.finish()
await pairOne.closed
await pairThird.until(started, "a freed slot did not start the next in line")
pairTwo.finish()
pairThird.finish()
await pairTwo.closed
await pairThird.closed

const leftover = [...fs.readdirSync(path.join(folder, "queue")), ...fs.readdirSync(path.join(folder, "small-queue"))]
if (leftover.length !== 0) fail(`the queue kept tickets: ${leftover.join(", ")}`)
fs.rmSync(folder, { recursive: true, force: true })
console.log("machine lock tests passed")
