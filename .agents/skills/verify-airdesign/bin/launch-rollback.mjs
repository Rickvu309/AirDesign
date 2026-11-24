import { once } from "node:events"
import { copyFileSync, existsSync, rmSync } from "node:fs"
import path from "node:path"

const patienceMs = 15_000

async function endChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  const ended = once(child, "exit")
  child.kill("SIGTERM")
  const timer = setTimeout(() => child.kill("SIGKILL"), patienceMs)
  await ended
  clearTimeout(timer)
}

export async function rollbackLaunch(child, teardown, scratch, evidenceLog) {
  try {
    if (child !== undefined) await endChild(child)
    await teardown()
  } finally {
    const scratchLog = path.join(scratch, "stack.log")
    if (existsSync(scratchLog)) copyFileSync(scratchLog, evidenceLog)
    rmSync(scratch, { recursive: true, force: true })
  }
}
