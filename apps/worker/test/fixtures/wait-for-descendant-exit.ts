import { setTimeout } from "node:timers/promises"
import { processIdentity } from "../../src/container-job-processes.ts"

export async function waitForDescendantExit(pids: readonly number[], timeout = 5000): Promise<void> {
  const deadline = performance.now() + timeout
  while (pids.some(pid => processIdentity(pid) !== null)) {
    if (performance.now() >= deadline) throw new Error("test-descendants-still-alive")
    await setTimeout(10)
  }
}
