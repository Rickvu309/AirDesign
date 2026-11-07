import { readFileSync, readdirSync } from "node:fs"

export type ProcessIdentity = { pid: number; identity: string }
type JobProcess = ProcessIdentity & { parent: number; residentBytes: number }

function stat(pid: number) {
  try {
    const value = readFileSync(`/proc/${pid}/stat`, "utf8")
    return value.slice(value.lastIndexOf(")") + 2).split(" ")
  } catch { return undefined }
}

export function processIdentity(pid: number): ProcessIdentity | null {
  const fields = stat(pid)
  const identity = fields?.[19]
  return identity && fields?.[0] !== "Z" && fields?.[0] !== "X" ? { pid, identity } : null
}

function matches(member: ProcessIdentity) {
  return stat(member.pid)?.[19] === member.identity
}

function signal(member: ProcessIdentity, value: NodeJS.Signals) {
  if (!matches(member)) return
  try { process.kill(member.pid, value) } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error
  }
}

export function containerJobProcesses(root: ProcessIdentity): JobProcess[] {
  const visited = new Set<number>()
  function visit(parent: ProcessIdentity): JobProcess[] {
    if (!matches(parent)) return []
    const members: JobProcess[] = []
    let tasks: string[]
    try { tasks = readdirSync(`/proc/${parent.pid}/task`) } catch { return [] }
    for (const task of tasks) {
      let children: string
      try { children = readFileSync(`/proc/${parent.pid}/task/${task}/children`, "utf8") } catch { continue }
      for (const name of children.trim().split(/\s+/)) {
        const pid = Number(name)
        if (!pid || visited.has(pid)) continue
        const fields = stat(pid)
        if (!fields?.[19] || Number(fields[1]) !== parent.pid) continue
        visited.add(pid)
        members.push(...visit({ pid, identity: fields[19] }))
        if (fields[0] !== "Z" && fields[0] !== "X") members.push({ pid, parent: parent.pid, identity: fields[19], residentBytes: Number(fields[21]) * 4096 })
      }
    }
    return matches(parent) ? members : []
  }
  return visit(root)
}

export function cleanContainerJob(root: ProcessIdentity, terminateRoot = true): void {
  const deadline = Date.now() + 5000
  if (terminateRoot) signal(root, "SIGSTOP")
  for (;;) {
    const members = containerJobProcesses(root).filter(member => member.pid !== process.pid)
    if (!members.length) break
    for (const member of members) signal(member, "SIGSTOP")
    for (const member of members) signal(member, "SIGKILL")
    if (Date.now() > deadline) throw new Error("container-job-cleanup-failed")
  }
  if (terminateRoot) signal(root, "SIGKILL")
}
