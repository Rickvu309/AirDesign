import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { expect, it } from "vitest"
import { waitForStartedPids } from "./fixtures/started-pids.ts"

it("waits through creation and a partial PID record until the writer completes it", async () => {
  const folder = await mkdtemp(path.join(os.homedir(), "tmp/started-pids-"))
  const file = path.join(folder, "started")
  try {
    for (const prefix of ["", "[123,"]) {
      await writeFile(file, prefix)
      expect(() => JSON.parse(prefix)).toThrow(SyntaxError)
      await expect(waitForStartedPids(file, AbortSignal.timeout(30))).rejects.not.toBeInstanceOf(SyntaxError)
    }
    const waiting = waitForStartedPids(file, AbortSignal.timeout(1000))
    await appendFile(file, "456]\n")
    await expect(waiting).resolves.toEqual([123, 456])
  } finally { await rm(folder, { recursive: true, force: true }) }
})

it("rejects malformed complete records instead of treating them as readiness", async () => {
  const folder = await mkdtemp(path.join(os.homedir(), "tmp/started-pids-"))
  const file = path.join(folder, "started")
  try {
    await writeFile(file, "[123,\n")
    await expect(waitForStartedPids(file, AbortSignal.timeout(1000))).rejects.toBeInstanceOf(SyntaxError)
    await writeFile(file, "[123,null]\n")
    await expect(waitForStartedPids(file, AbortSignal.timeout(1000))).rejects.toThrow()
  } finally { await rm(folder, { recursive: true, force: true }) }
})
