import { readFileSync, readlinkSync } from "node:fs"
import path from "node:path"
import { containerJobProcesses, processIdentity, signalContainerProcess, type ProcessIdentity } from "./container-job-processes.ts"

const jobs = new Map<number, ProcessIdentity>()
let ownership: { outer: ProcessIdentity; guardian: ProcessIdentity } | null = null

export function containerOuterRoot(pid: number): ProcessIdentity {
  const root = processIdentity(pid)
  const args = readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0")
  const entry = new URL("./container-worker-entry.ts", import.meta.url).pathname
  if (!root || path.basename(readlinkSync(`/proc/${pid}/exe`)) !== "tini" || args[1] !== "-s" || args[2] !== "--" || (args[3] !== process.execPath && args[3] !== "node") || !args[4] || path.resolve(args[4]) !== entry) throw new Error("invalid-container-worker-subreaper")
  return root
}

function initializeContainerWorker(): boolean {
  const parent = processIdentity(process.ppid)
  if (!parent || process.env.AIRDESIGN_OUTER_GUARDIAN !== `${parent.pid}:${parent.identity}`) return false
  const args = readFileSync(`/proc/${parent.pid}/cmdline`, "utf8").split("\0")
  if (!args[1] || path.resolve(args[1]) !== new URL("./container-worker-entry.ts", import.meta.url).pathname || readlinkSync(`/proc/${parent.pid}/exe`) !== process.execPath) return false
  const value = readFileSync(`/proc/${parent.pid}/stat`, "utf8")
  const outer = containerOuterRoot(Number(value.slice(value.lastIndexOf(")") + 2).split(" ")[1]))
  ownership = { outer, guardian: parent }
  sweepContainerOrphans()
  setInterval(sweepContainerOrphans, 100).unref()
  process.once("exit", () => {
    jobs.clear()
    sweepContainerOrphans()
  })
  return true
}

export function ensureContainerWorker(): void {
  if (process.env.AIRDESIGN_ISOLATION !== "container") return
  if (ownership && process.ppid === ownership.guardian.pid && processIdentity(ownership.guardian.pid)?.identity === ownership.guardian.identity && processIdentity(ownership.outer.pid)?.identity === ownership.outer.identity) return
  if (initializeContainerWorker()) return
  const entry = process.argv[1]
  if (!entry) throw new Error("missing-container-worker-entry")
  const env = Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => typeof pair[1] === "string"))
  if (!process.execve) throw new Error("container-worker-requires-execve")
  process.execve("/usr/bin/env", ["env", "tini", "-s", "--", process.execPath, new URL("./container-worker-entry.ts", import.meta.url).pathname, entry, ...process.argv.slice(2)], env)
  throw new Error("container-worker-reexec-failed")
}

export function registerContainerJob(root: ProcessIdentity): void {
  jobs.set(root.pid, root)
}

export function unregisterContainerJob(root: ProcessIdentity): void {
  if (jobs.get(root.pid)?.identity === root.identity) jobs.delete(root.pid)
  sweepContainerOrphans()
}

export function sweepContainerOrphans(): void {
  if (!ownership) return
  const { outer, guardian } = ownership
  if (processIdentity(guardian.pid)?.identity !== guardian.identity) throw new Error("container-worker-guardian-lost")
  if (processIdentity(outer.pid)?.identity !== outer.identity) throw new Error("container-worker-subreaper-lost")
  const deadline = Date.now() + 5000
  for (;;) {
    const orphans = containerJobProcesses(outer, [...jobs.values()]).filter(member => member.pid !== process.pid && member.pid !== guardian.pid)
    if (!orphans.length) return
    for (const member of orphans) signalContainerProcess(member, "SIGSTOP")
    for (const member of orphans) signalContainerProcess(member, "SIGKILL")
    if (Date.now() > deadline) throw new Error("container-orphan-cleanup-failed")
  }
}
