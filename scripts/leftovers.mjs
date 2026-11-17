import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { usedByAProcess } from "./worktrees.mjs"

const hours = 60 * 60 * 1000

export const clusterIdle = hours
export const evidenceIdle = 12 * hours

const touchedAt = (...files) =>
  Math.max(
    ...files.map((file) => {
      try {
        return fs.statSync(file).mtimeMs
      } catch {
        return 0
      }
    }),
  )

const listed = (folder) => {
  try {
    return fs.readdirSync(folder).sort()
  } catch {
    return []
  }
}

const postgresRuns = (dir) => {
  try {
    const pid = Number(fs.readFileSync(path.join(dir, "data", "postmaster.pid"), "utf8").split("\n")[0])
    return Number.isInteger(pid) && pid > 0 && fs.readFileSync(`/proc/${String(pid)}/cmdline`, "utf8").includes(dir)
  } catch {
    return false
  }
}

export const findLeftovers = ({ home = os.homedir(), now = Date.now(), busy = usedByAProcess }) => {
  const tmp = path.join(home, "tmp")
  const evidence = path.join(tmp, "verify-airdesign")
  const runs = listed(evidence)
    .filter((run) => !fs.existsSync(path.join(tmp, "verify-airdesign-scratch", run)))
    .map((run) => path.join(evidence, run))
    .filter((dir) => fs.statSync(dir).isDirectory())
    .filter((dir) => now - touchedAt(dir, path.join(dir, "proof.md")) > evidenceIdle && !busy(dir))
    .map((dir) => ({ path: dir, reason: "its verify run ended 12 hours ago" }))
  const clusters = listed(tmp)
    .filter((name) => name.startsWith("airdesign-api-"))
    .map((name) => path.join(tmp, name))
    .filter((dir) => now - touchedAt(dir, path.join(dir, "server.log")) > clusterIdle)
    .filter((dir) => !postgresRuns(dir) && !busy(dir))
    .map((dir) => ({ path: dir, reason: "its postgres is not running" }))
  return [...runs, ...clusters]
}

export const removeLeftovers = ({ say = console.log, apply = true, ...options }) => {
  const removed = []
  for (const leftover of findLeftovers(options)) {
    if (!apply) {
      say(`would remove ${leftover.path}, because ${leftover.reason}`)
      continue
    }
    fs.rmSync(leftover.path, { recursive: true, force: true })
    say(`removed ${leftover.path}, because ${leftover.reason}`)
    removed.push(leftover.path)
  }
  return removed
}
