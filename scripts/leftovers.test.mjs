import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { clusterIdle, evidenceIdle, findLeftovers, removeLeftovers } from "./leftovers.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const home = fs.mkdtempSync(path.join(os.tmpdir(), "leftovers-"))
const children = []
process.on("exit", () => {
  for (const child of children) child.kill("SIGKILL")
  fs.rmSync(home, { recursive: true, force: true })
})

const tmp = path.join(home, "tmp")
const deadPid = spawnSync(process.execPath, ["-e", ""]).pid
const cluster = (name, pid) => {
  const dir = path.join(tmp, name)
  fs.mkdirSync(path.join(dir, "data"), { recursive: true })
  fs.writeFileSync(path.join(dir, "server.log"), "")
  if (pid !== undefined) fs.writeFileSync(path.join(dir, "data", "postmaster.pid"), `${String(pid)}\n${dir}/data\n`)
  return dir
}
const run = (name) => {
  const dir = path.join(tmp, "verify-airdesign", name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "proof.md"), "# run\n")
  return dir
}

const dead = cluster("airdesign-api-dead", deadPid)
const starting = cluster("airdesign-api-starting")
const liveDir = cluster("airdesign-api-live", 0)
const postmaster = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)", "--", "-D", `${liveDir}/data`], {
  stdio: "ignore",
})
children.push(postmaster)
while (!fs.readFileSync(`/proc/${String(postmaster.pid)}/cmdline`, "utf8").includes(liveDir)) {
  await new Promise((resolve) => setTimeout(resolve, 10))
}
fs.writeFileSync(path.join(liveDir, "data", "postmaster.pid"), `${String(postmaster.pid)}\n`)
const finished = run("2026-11-16T01-00-00-000Z-aaaaaa")
const kept = run("prove-2026-11-16T01-00-00-000Z")
const notMine = path.join(tmp, "notes")
fs.mkdirSync(notMine)

const busy = (where) => where === kept
const names = (list) => list.map((leftover) => path.basename(leftover.path)).sort()

same("nothing is a leftover while it is fresh", names(findLeftovers({ home, busy })), [])
const later = Date.now() + clusterIdle + 60_000
same(
  "a cluster whose postgres is not running is a leftover after an idle hour, whether it died or never started",
  names(findLeftovers({ home, busy, now: later })),
  ["airdesign-api-dead", "airdesign-api-starting"],
)
const muchLater = Date.now() + evidenceIdle + 60_000
same(
  "a verify run's evidence is a leftover after 12 idle hours, unless a process uses it",
  names(findLeftovers({ home, busy, now: muchLater })),
  ["2026-11-16T01-00-00-000Z-aaaaaa", "airdesign-api-dead", "airdesign-api-starting"],
)
same(
  "each says why",
  findLeftovers({ home, busy, now: muchLater }).map((leftover) => leftover.reason),
  ["its verify run ended 12 hours ago", "its postgres is not running", "its postgres is not running"],
)

const dry = []
same(
  "a dry run removes nothing",
  removeLeftovers({ home, busy, now: muchLater, apply: false, say: (line) => dry.push(line) }),
  [],
)
same("and says what would go", dry.length, 3)
same(
  "with would",
  dry.every((line) => line.startsWith("would remove ")),
  true,
)
same(
  "the folders are still there",
  [dead, starting, finished].every((dir) => fs.existsSync(dir)),
  true,
)

const said = []
same(
  "an applied run removes them",
  removeLeftovers({ home, busy, now: muchLater, say: (line) => said.push(line) }).map((where) => path.basename(where)),
  ["2026-11-16T01-00-00-000Z-aaaaaa", "airdesign-api-dead", "airdesign-api-starting"],
)
same(
  "and keeps the rest",
  [liveDir, kept, notMine].every((dir) => fs.existsSync(dir)),
  true,
)
same("a live postgres was not signalled", postmaster.exitCode === null && postmaster.signalCode === null, true)

console.log("leftovers tests passed")
