import { randomBytes } from "node:crypto"
import { readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"

const statelessAgeMs = 24 * 60 * 60 * 1000
const runShape = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f]{6}$/

export function newRun() {
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`
}

export function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function commandLine(pid) {
  try {
    return readFileSync(`/proc/${String(pid)}/cmdline`, "utf8")
      .split("\0")
      .join(" ")
  } catch {
    return ""
  }
}

export function ownsServe(state) {
  return alive(state.pid) && commandLine(state.pid).includes(`serve ${state.run}`)
}

export function writeAtomic(file, text) {
  const temp = `${file}.${String(process.pid)}.tmp`
  writeFileSync(temp, text)
  renameSync(temp, file)
}

export function writeOwner(dir, repo) {
  writeAtomic(path.join(dir, "owner"), repo)
}

export function ownerOf(dir) {
  try {
    const owner = readFileSync(path.join(dir, "owner"), "utf8")
    return owner === "" ? undefined : owner
  } catch {
    return stateIn(dir)?.repo
  }
}

export function stateIn(dir) {
  try {
    return JSON.parse(readFileSync(path.join(dir, "state.json"), "utf8"))
  } catch {
    return undefined
  }
}

function runNames(scratchRoot) {
  try {
    return readdirSync(scratchRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && runShape.test(entry.name))
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

export function runsOf({ scratchRoot, repo }) {
  return runNames(scratchRoot).filter((run) => ownerOf(path.join(scratchRoot, run)) === repo)
}

export function foreignRun({ scratchRoot, repo, run }) {
  const owner = ownerOf(path.join(scratchRoot, run))
  return owner !== undefined && owner !== repo ? owner : undefined
}

export async function removeLeftoverRuns({ scratchRoot, repo, stop, now = Date.now() }) {
  const stopped = []
  const removed = []
  for (const run of runNames(scratchRoot)) {
    const dir = path.join(scratchRoot, run)
    const owner = ownerOf(dir)
    if (owner !== undefined && owner !== repo) continue
    const state = stateIn(dir)
    if (state !== undefined) {
      if (state.run === run && !ownsServe(state)) {
        await stop(run)
        stopped.push(run)
      }
      continue
    }
    if (now - statSync(dir).mtimeMs < statelessAgeMs) continue
    rmSync(dir, { recursive: true, force: true })
    removed.push(dir)
  }
  return { stopped, removed }
}
