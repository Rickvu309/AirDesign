import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  checkSlots,
  laneProtocol,
  queueLogName,
  recentRunSeconds,
  takeMachineLock,
  takeSpeedLock,
  waitLine,
} from "./machine-lock.mjs"

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

const waiter = (
  job = "check",
  lane = "full",
  { slots = 1, cwd = process.cwd(), into = folder, launcher = false, load = 0 } = {},
) => {
  const script = `import fs from "node:fs"
       import net from "node:net"
       import { takeMachineLock } from ${JSON.stringify(module)}
       process.on("exit", (code) => fs.writeSync(2, "exit " + code + "\\n"))
       const release = await takeMachineLock({ folder: ${JSON.stringify(into)}, env: { AIRDESIGN_CHECK_SLOTS: "${slots}" }, poll: 50, load: () => ${load}, cores: 8, job: ${JSON.stringify(job)}, lane: ${JSON.stringify(lane)} })
       console.log("started")
       new net.Socket({ fd: 3, readable: true, writable: false }).once("data", async (word) => {
         if (String(word).startsWith("go")) await release()
         process.exit(0)
       })`
  const node = [process.execPath, "--input-type=module", "-e", script]
  const run = launcher ? ["sh", "-c", 'sh -c \'"$@"; echo\' sh "$@"; echo', "sh", ...node] : node
  const child = spawn(run[0], run.slice(1), { cwd, stdio: ["ignore", "pipe", "pipe", "pipe"] })
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
  return { child, seen, until, closed, finish: (word = "go") => child.stdio[3].write(`${word}\n`) }
}
const started = (seen) => seen.out.includes("started")
const placed = (place) => (seen) => seen.err.includes(`number ${place} in line`)

const speedFolder = path.join(folder, "speed")
const releaseSpeed = await within(takeSpeedLock({ folder: speedFolder }), "a free speed lock kept a check waiting")
try {
  assert.ok(fs.existsSync(path.join(speedFolder, "speed.lock")), "the speed lock uses its own directory")
  await assert.rejects(
    within(takeSpeedLock({ folder: speedFolder, waitSeconds: 0 }), "the speed lock did not honor its wait limit"),
    {
      message: `speed not measured: could not acquire ${path.join(speedFolder, "speed.lock")} (wait limit 0 s); check for a running speed spec or bench`,
    },
  )
} finally {
  await releaseSpeed()
}
const reacquiredSpeed = await within(takeSpeedLock({ folder: speedFolder }), "the speed lock was not released")
await reacquiredSpeed()

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

const fieldsFolder = fs.mkdtempSync(path.join(os.tmpdir(), "machine-lock-fields-"))
const releaseWithFields = await takeMachineLock({ folder: fieldsFolder, env: {}, say, job: "rerun", lane: "small" })
await releaseWithFields({ status: "passed", file: "apps/web/src/x.test.ts", tree: "ab12cd34" })
const releaseBare = await takeMachineLock({ folder: fieldsFolder, env: {}, say, job: "rerun", lane: "small" })
await releaseBare({ status: "passed" })
const [withFields, bare] = fs
  .readFileSync(path.join(fieldsFolder, queueLogName), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line))
if (withFields.file !== "apps/web/src/x.test.ts" || withFields.tree !== "ab12cd34" || withFields.status !== "passed")
  fail("the queue row does not carry the file and tree a release was given")
if ("file" in bare || "tree" in bare) fail("a release with no file or tree wrote them into its row")

const gib = 2 ** 30
if (checkSlots({}, 8, 16 * gib) !== 1) fail("a small machine ran more than one check at once")
if (checkSlots({}, 32, 16 * gib) !== 1) fail("16 GB of memory ran more than one check at once")
if (checkSlots({}, 48, 47 * gib) !== 3) fail("48 cores and 47 GB did not run three checks at once")
if (checkSlots({ AIRDESIGN_CHECK_SLOTS: "2" }, 48, 47 * gib) !== 2) fail("the owner's slot count was ignored")
if (checkSlots({ AIRDESIGN_CHECK_SLOTS: "zero" }, 8, 16 * gib) !== 1) fail("a bad slot count was not ignored")

const trees = fs.mkdtempSync(path.join(os.tmpdir(), "machine-lock-trees-"))
const tree = (name) => {
  const root = path.join(trees, name)
  fs.mkdirSync(path.join(root, "apps"), { recursive: true })
  fs.writeFileSync(path.join(root, ".git"), "gitdir: elsewhere\n")
  return root
}
const pairOne = waiter("check", "full", { slots: 2, cwd: tree("pair-one") })
const pairTwo = waiter("check", "full", { slots: 2, cwd: tree("pair-two") })
await pairOne.until(started, "the first of two slots did not start")
await pairTwo.until(started, "a second free slot kept a check waiting")
const pairThird = waiter("check", "full", { slots: 2, cwd: tree("pair-third") })
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

const busyOne = waiter("check", "full", { slots: 2, load: 100 })
await busyOne.until(started, "a busy machine kept the first slot from a check")
const busyTwo = waiter("check", "full", { slots: 2, load: 100 })
await busyTwo.until(placed(1), "a check on a busy machine did not wait for its turn")
await settle()
if (started(busyTwo.seen)) fail("a second slot opened while the load was above the core count")
busyOne.finish()
await busyOne.closed
await busyTwo.until(started, "a freed first slot did not start the next check on a busy machine")
busyTwo.finish()
await busyTwo.closed
const one = tree("one")
const two = tree("two")
const exited = (seen) => /^exit \d+$/m.test(seen.err)
const failed = (seen) => /^exit [1-9]\d*$/m.test(seen.err)

const holding = waiter("check", "full", { cwd: one, launcher: true })
await holding.until(started, "a check did not take a free machine")
const older = waiter("check", "full", { cwd: one })
await older.until(placed(1))
const elsewhere = waiter("check", "full", { cwd: two })
await elsewhere.until(placed(2))
const otherKind = waiter("pptx", "full", { cwd: one })
await otherKind.until(placed(3))
const newer = waiter("check", "full", { cwd: path.join(one, "apps") })
await within(older.closed, "an older waiting check from the same worktree kept its place when a newer one queued")
if (!failed(older.seen)) fail("a check a newer one replaced did not exit non-zero")
if (!older.seen.err.includes("newer check") || !older.seen.err.includes(String(newer.child.pid)))
  fail(`a replaced check did not name the newer one: ${older.seen.err}`)
await elsewhere.until(placed(1), "a check from another worktree did not move up when a replaced check left")
await newer.until(placed(3), "a newer check did not keep its place behind the jobs ahead of it")
await settle()
if (exited(otherKind.seen)) fail("a newer check dropped a waiting job of another kind from the same worktree")
if (exited(holding.seen)) fail("a newer check from the same worktree stopped the one holding the machine")

const orphan = waiter("check", "full", { cwd: tree("three"), launcher: true })
await orphan.until(placed(4))
process.kill(orphan.child.pid, "SIGKILL")
await within(orphan.closed, "a check whose launcher exited kept waiting in line")
if (!failed(orphan.seen) || !orphan.seen.err.includes("abandoned"))
  fail(`an abandoned check did not leave with a message and a non-zero exit: ${orphan.seen.err}`)

process.kill(holding.child.pid, "SIGKILL")
await settle()
if (exited(holding.seen)) fail(`a check that holds the machine stopped when its launcher exited: ${holding.seen.err}`)
holding.finish()
await holding.until(exited, "a check whose launcher exited could not finish its run")
for (const job of [elsewhere, otherKind, newer]) {
  await job.until(started, "a job behind replaced and abandoned ones never started")
  job.finish()
  await job.closed
}
if ([elsewhere, otherKind, newer].some((job) => failed(job.seen)))
  fail("a job behind replaced and abandoned ones failed")
fs.rmSync(trees, { recursive: true, force: true })

const leftover = [...fs.readdirSync(path.join(folder, "queue")), ...fs.readdirSync(path.join(folder, "small-queue"))]
if (leftover.length !== 0) fail(`the queue kept tickets: ${leftover.join(", ")}`)
if (!fs.existsSync(path.join(folder, `lane-protocol-${laneProtocol}`)))
  fail("a check did not record its lane protocol in the queue folder")

const newerProtocol = fs.mkdtempSync(path.join(os.tmpdir(), "machine-lock-"))
fs.writeFileSync(path.join(newerProtocol, `lane-protocol-${laneProtocol + 1}`), "")
const stale = waiter("check", "full", { into: newerProtocol })
await within(stale.closed, "a check with older queue code waited in line")
if (stale.child.exitCode !== 1) fail("a check with older queue code did not fail")
if (started(stale.seen)) fail("a check with older queue code started")
if (!stale.seen.err.includes("git fetch origin && git rebase origin/main"))
  fail(`a check with older queue code did not say how to rebase: ${stale.seen.err}`)
if (fs.existsSync(path.join(newerProtocol, "queue")) && fs.readdirSync(path.join(newerProtocol, "queue")).length !== 0)
  fail("a check with older queue code left a ticket")
fs.rmSync(newerProtocol, { recursive: true, force: true })
fs.rmSync(folder, { recursive: true, force: true })
console.log("machine lock tests passed")
