import { expect, it } from "vitest"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { waitForDescendantExit } from "./fixtures/wait-for-descendant-exit.ts"
import { processIdentity } from "../src/container-job-processes.ts"

it("waits for an exiting descendant without accepting a survivor", async () => {
  const child = spawn("sleep", ["300"], { stdio: "ignore" })
  const exited = once(child, "exit")
  if (!child.pid) throw new Error("missing-test-descendant")
  const pids = [child.pid]
  try {
    expect(processIdentity(child.pid)).not.toBeNull()
    await expect(waitForDescendantExit(pids, 30)).rejects.toThrow("test-descendants-still-alive")
    let completed = false
    const waiting = waitForDescendantExit(pids).then(() => { completed = true })
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(completed).toBe(false)
    child.kill("SIGKILL")
    await waiting
    expect(processIdentity(child.pid)).toBeNull()
  } finally {
    child.kill("SIGKILL")
    await exited
  }
})
