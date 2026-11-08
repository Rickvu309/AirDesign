import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { once } from "node:events"
import path from "node:path"
import { setTimeout } from "node:timers/promises"
import { spawn } from "node:child_process"
import { ensureContainerWorker, sweepContainerOrphans } from "../../src/container-worker-ownership.ts"
import { spawnContainerJob, killContainerJob, containerJobFailure } from "../../src/container-process.ts"
import { processIdentity } from "../../src/container-job-processes.ts"

ensureContainerWorker()
ensureContainerWorker()
const directory = process.argv[2]
if (!directory) throw new Error("missing-test-directory")
async function ready(file: string): Promise<number> {
  const deadline = Date.now() + 10000
  for (;;) {
    try {
      const pid = Number(readFileSync(file, "utf8"))
      if (pid > 1) return pid
    } catch {}
    if (Date.now() > deadline) throw new Error("test-process-not-ready")
    await setTimeout(10)
  }
}
if (process.argv[3] === "recovered") {
  const pids: number[] = JSON.parse(readFileSync(path.join(directory, "pids"), "utf8"))
  assert(pids.every(pid => processIdentity(pid) === null))
  process.stdout.write("recovered\n")
} else {
  const first = path.join(directory, "hostile"), second = path.join(directory, "honest")
  mkdirSync(first); mkdirSync(second)
  const honest = spawnContainerJob(second, new URL("./active-job.ts", import.meta.url).pathname)
  const honestExit = once(honest, "exit")
  const hostile = spawnContainerJob(first, new URL("./killed-subreaper-job.ts", import.meta.url).pathname)
  const hostileExit = once(hostile, "exit")
  try {
    const honestPid = await ready(path.join(second, "descendant"))
    const hostilePid = await ready(path.join(first, "descendant"))
    await ready(path.join(second, "healthy"))
    writeFileSync(path.join(directory, "pids"), JSON.stringify([honestPid, hostilePid]))
    if (process.argv[3] === "crash") {
      process.kill(process.pid, "SIGKILL")
    }
    if (process.argv[3] === "restart") {
      const env = Object.fromEntries(Object.entries(process.env).filter((pair): pair is [string, string] => typeof pair[1] === "string"))
      if (!process.execve) throw new Error("test-requires-execve")
      process.execve(process.execPath, [process.execPath, new URL(import.meta.url).pathname, directory, "recovered"], env)
      throw new Error("test-reexec-failed")
    }
    writeFileSync(path.join(first, "attack"), "start")
    const [, signal] = await hostileExit
    assert.equal(signal, "SIGKILL")
    assert.deepEqual(containerJobFailure(hostile), { kind: "isolation", reason: "subreaper-lost" })
    assert.equal(processIdentity(hostilePid), null)
    assert(processIdentity(honestPid))
    const orphan = spawn("sleep", ["300"], { detached: true, stdio: "ignore" })
    if (!orphan.pid) throw new Error("missing-test-orphan")
    const orphanExit = once(orphan, "exit")
    await orphanExit
    assert.equal(processIdentity(orphan.pid), null)
    assert(processIdentity(honestPid))
    sweepContainerOrphans()
    assert(processIdentity(honestPid))
    killContainerJob(honest)
    await honestExit
    assert.equal(processIdentity(honestPid), null)
    process.stdout.write("isolated\n")
  } finally {
    killContainerJob(hostile)
    killContainerJob(honest)
    await Promise.all([hostileExit, honestExit])
  }
}
