import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const held = "AIRDESIGN_MACHINE_LOCK"
const slotsSetting = "AIRDESIGN_CHECK_SLOTS"
const onCi = (env) => env.CI === "true" || env.CI === "1"

export const machineLockFolder = path.join(os.homedir(), ".cache", "airdesign")
export const queueLogName = "check-queue.jsonl"

const lanes = {
  full: { file: "machine.lock", queue: "queue", holder: "Another check holds the machine." },
  small: { file: "small.lock", queue: "small-queue", holder: "Another small job holds the small lane." },
}

export const smallLaneCommand = (command, args) => ["nice", ["-n", "10", command, ...args]]

const hold = (file) =>
  new Promise((resolve) => {
    const holder = spawn("flock", ["-n", file, "sh", "-c", "echo held; exec cat"], {
      stdio: ["pipe", "pipe", "ignore"],
    })
    holder.on("error", () => resolve(undefined))
    holder.on("exit", () => resolve(undefined))
    holder.stdout.once("data", () => {
      holder.unref()
      holder.stdin.unref()
      holder.stdout.unref()
      resolve(holder)
    })
  })

const letGo = (holder) =>
  new Promise((freed) => {
    holder.ref()
    holder.once("exit", freed)
    holder.stdin.end()
  })

const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === "EPERM"
  }
}

const liveTickets = (queue) =>
  fs
    .readdirSync(queue)
    .filter((name) => /^\d+-\d+$/.test(name))
    .sort()
    .filter((name) => {
      if (alive(Number(name.split("-")[1]))) return true
      fs.rmSync(path.join(queue, name), { force: true })
      return false
    })

const nextTicket = (folder) => {
  const counter = path.join(folder, "queue-number")
  const taken = spawnSync(
    "flock",
    [
      `${counter}.lock`,
      "sh",
      "-c",
      'n=$(($(cat "$1" 2>/dev/null || echo 0) + 1)); echo "$n" > "$1"; echo "$n"',
      "sh",
      counter,
    ],
    { encoding: "utf8" },
  )
  return taken.stdout.trim().padStart(12, "0")
}

export const recentRunSeconds = (log, count = 20, lane = "full") => {
  try {
    const runs = fs
      .readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .filter((row) => (row.lane ?? "full") === lane)
      .slice(-count)
      .map((row) => row.ran)
      .filter((ran) => typeof ran === "number")
      .sort((left, right) => left - right)
    return runs.length === 0 ? undefined : runs[Math.floor(runs.length / 2)]
  } catch {
    return undefined
  }
}

export const checkSlots = (env = process.env, cores = os.availableParallelism(), memory = os.totalmem()) => {
  const asked = Number(env[slotsSetting])
  if (Number.isInteger(asked) && asked > 0) return asked
  return Math.max(1, Math.min(Math.floor(cores / 16), Math.floor(memory / 2 ** 30 / 12)))
}

export const waitLine = (place, typical, lane = "full") => {
  const line = `${lanes[lane].holder} This one is number ${place} in line.`
  if (typical === undefined) return line
  const minutes = Math.max(1, Math.round((place * typical) / 60))
  return `${line} Expect about ${minutes} min: a recent run took ${Math.round(typical)} s.`
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const takeMachineLock = async ({
  folder = machineLockFolder,
  job = "check",
  lane = "full",
  env = process.env,
  say = console.error,
  poll = 500,
  clock = () => performance.now(),
  date = () => new Date(),
} = {}) => {
  const free = () => {}
  const first = path.join(folder, lanes[lane].file)
  const holds = (name) => env[held] === path.join(folder, name) || env[held]?.startsWith(`${path.join(folder, name)}.`)
  if (onCi(env) || holds(lanes[lane].file) || holds(lanes.full.file)) return free
  const slots = lane === "full" ? checkSlots(env) : 1
  const files = Array.from({ length: slots }, (_, slot) => (slot === 0 ? first : `${first}.${slot}`))
  if (spawnSync("flock", ["--version"]).status !== 0) return free
  const queue = path.join(folder, lanes[lane].queue)
  fs.mkdirSync(queue, { recursive: true })
  const queued = clock()
  const queuedAt = date().toISOString()
  const ticket = path.join(queue, `${nextTicket(folder)}-${process.pid}`)
  fs.writeFileSync(ticket, `${job} ${process.cwd()}\n`)
  const leave = () => fs.rmSync(ticket, { force: true })
  process.once("exit", leave)
  const log = path.join(folder, queueLogName)
  let holder
  let file
  let told
  for (;;) {
    const ahead = liveTickets(queue).indexOf(path.basename(ticket))
    for (const slot of ahead < slots ? files : []) {
      holder = await hold(slot)
      if (holder) {
        file = slot
        break
      }
    }
    if (holder) break
    const place = Math.max(1, ahead - slots + 2)
    if (told !== place) say(waitLine(place, recentRunSeconds(log, 20, lane), lane))
    told = place
    await pause(poll)
  }
  leave()
  process.removeListener("exit", leave)
  const started = clock()
  env[held] = file
  let recorded = false
  const record = (status = "exited") => {
    if (recorded) return
    recorded = true
    const seconds = (from, to) => Math.round((to - from) / 100) / 10
    const row = {
      job,
      lane,
      status,
      cwd: process.cwd(),
      queued: queuedAt,
      waited: seconds(queued, started),
      ran: seconds(started, clock()),
    }
    fs.appendFileSync(log, `${JSON.stringify(row)}\n`)
  }
  const exited = () => record()
  process.once("exit", exited)
  return ({ status = "done" } = {}) => {
    record(status)
    process.removeListener("exit", exited)
    delete env[held]
    return letGo(holder)
  }
}
