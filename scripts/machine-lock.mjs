import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const held = "AIRDESIGN_MACHINE_LOCK"
const onCi = (env) => env.CI === "true" || env.CI === "1"

export const machineLockFolder = path.join(os.homedir(), ".cache", "airdesign")
export const queueLogName = "check-queue.jsonl"

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

export const recentRunSeconds = (log, count = 20) => {
  try {
    const runs = fs
      .readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .slice(-count)
      .map((line) => JSON.parse(line).ran)
      .filter((ran) => typeof ran === "number")
      .sort((left, right) => left - right)
    return runs.length === 0 ? undefined : runs[Math.floor(runs.length / 2)]
  } catch {
    return undefined
  }
}

export const waitLine = (place, typical) => {
  const line = `Another check holds the machine. This one is number ${place} in line.`
  if (typical === undefined) return line
  const minutes = Math.max(1, Math.round((place * typical) / 60))
  return `${line} Expect about ${minutes} min: a recent run took ${Math.round(typical)} s.`
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const takeMachineLock = async ({
  folder = machineLockFolder,
  job = "check",
  env = process.env,
  say = console.error,
  poll = 500,
  clock = () => performance.now(),
  date = () => new Date(),
} = {}) => {
  const free = () => {}
  const file = path.join(folder, "machine.lock")
  if (onCi(env) || env[held] === file) return free
  if (spawnSync("flock", ["--version"]).status !== 0) return free
  const queue = path.join(folder, "queue")
  fs.mkdirSync(queue, { recursive: true })
  const queued = clock()
  const queuedAt = date().toISOString()
  const ticket = path.join(queue, `${nextTicket(folder)}-${process.pid}`)
  fs.writeFileSync(ticket, `${job} ${process.cwd()}\n`)
  const leave = () => fs.rmSync(ticket, { force: true })
  process.once("exit", leave)
  const log = path.join(folder, queueLogName)
  let holder
  let told
  for (;;) {
    const ahead = liveTickets(queue).indexOf(path.basename(ticket))
    if (ahead === 0) holder = await hold(file)
    if (holder) break
    if (told !== ahead + 1) say(waitLine(ahead + 1, recentRunSeconds(log)))
    told = ahead + 1
    await pause(poll)
  }
  leave()
  process.removeListener("exit", leave)
  const started = clock()
  env[held] = file
  let recorded = false
  const record = () => {
    if (recorded) return
    recorded = true
    const seconds = (from, to) => Math.round((to - from) / 100) / 10
    const row = {
      job,
      cwd: process.cwd(),
      queued: queuedAt,
      waited: seconds(queued, started),
      ran: seconds(started, clock()),
    }
    fs.appendFileSync(log, `${JSON.stringify(row)}\n`)
  }
  process.once("exit", record)
  return () => {
    record()
    process.removeListener("exit", record)
    delete env[held]
    return letGo(holder)
  }
}
