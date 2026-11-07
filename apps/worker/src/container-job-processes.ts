import { readFileSync, readdirSync } from "node:fs"

type JobProcess = { pid: number; parent: number; identity: string; residentBytes: number }

function stat(pid: number) {
  try {
    const value = readFileSync(`/proc/${pid}/stat`, "utf8")
    return value.slice(value.lastIndexOf(")") + 2).split(" ")
  } catch { return undefined }
}

export function containerJobProcesses(directory: string): JobProcess[] {
  const marker = `AIRDESIGN_JOB_DIRECTORY=${directory}`
  const processes: JobProcess[] = []
  const owned = new Set<number>()
  for (const name of readdirSync("/proc")) {
    if (!/^\d+$/.test(name)) continue
    const pid = Number(name), fields = stat(pid)
    if (!fields || fields[0] === "Z" || fields[0] === "X" || !fields[19]) continue
    processes.push({ pid, parent: Number(fields[1]), identity: fields[19], residentBytes: Number(fields[21]) * 4096 })
    try { if (readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").includes(marker)) owned.add(pid) } catch {}
  }
  let previous = 0
  while (previous !== owned.size) {
    previous = owned.size
    for (const entry of processes) if (owned.has(entry.parent)) owned.add(entry.pid)
  }
  return processes.filter(entry => owned.has(entry.pid) && entry.pid !== process.pid)
}

export function cleanContainerJob(directory: string): void {
  const deadline = Date.now() + 5000
  for (;;) {
    const members = containerJobProcesses(directory)
    if (!members.length) return
    for (const member of members) {
      if (stat(member.pid)?.[19] !== member.identity) continue
      try { process.kill(member.pid, "SIGKILL") } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error
      }
    }
    if (Date.now() > deadline) throw new Error("container-job-cleanup-failed")
  }
}
