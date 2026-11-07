import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { readFile, readdir } from "node:fs/promises"

async function processTree(rootPid: number) {
  const ids = (await readdir("/proc")).filter(id => /^\d+$/.test(id))
  const processes = await Promise.all(ids.map(async id => {
    const stat = await readFile(`/proc/${id}/stat`, "utf8").catch(() => "")
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ")
    return { id: Number(id), parent: Number(fields[1]), started: fields[19] }
  }))
  const owned = new Set([rootPid])
  let previousSize = 0
  while (owned.size !== previousSize) {
    previousSize = owned.size
    for (const entry of processes) if (owned.has(entry.parent)) owned.add(entry.id)
  }
  return processes.filter(entry => owned.has(entry.id))
}

export async function killExportDescendants(rootPid: number): Promise<void> {
  const children = (await processTree(rootPid)).filter(entry => entry.id !== rootPid)
  for (const child of children.reverse()) {
    const stat = await readFile(`/proc/${child.id}/stat`, "utf8").catch(() => "")
    if (stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19] !== child.started) continue
    try { process.kill(child.id, "SIGKILL") } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error }
  }
}

export async function residentBytes(rootPid: number): Promise<number> {
  const sizes = await Promise.all((await processTree(rootPid)).map(async ({ id }) => {
    const status = await readFile(`/proc/${id}/status`, "utf8").catch(() => "")
    return Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0) * 1024
  }))
  return sizes.reduce((total, size) => total + size, 0)
}

export async function scopeOomKilled(unit: string): Promise<boolean> {
  const run = promisify(execFile)
  const result = await run("systemctl", ["--user", "show", "--property=Result", "--value", unit], { maxBuffer: 1024 }).catch(() => ({ stdout: "" }))
  if (result.stdout.trim() !== "oom-kill") return false
  await run("systemctl", ["--user", "reset-failed", unit], { maxBuffer: 1024 }).catch(() => undefined)
  return true
}
