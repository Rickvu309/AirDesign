import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { containerJobProcesses } from "../container-job-processes.ts"

export function residentBytes(directory: string): number {
  return containerJobProcesses(directory).reduce((total, member) => total + member.residentBytes, 0)
}

export async function scopeOomKilled(unit: string): Promise<boolean> {
  const run = promisify(execFile)
  const result = await run("systemctl", ["--user", "show", "--property=Result", "--value", unit], { maxBuffer: 1024 }).catch(() => ({ stdout: "" }))
  if (result.stdout.trim() !== "oom-kill") return false
  await run("systemctl", ["--user", "reset-failed", unit], { maxBuffer: 1024 }).catch(() => undefined)
  return true
}
