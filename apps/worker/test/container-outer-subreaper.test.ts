import { expect, it } from "vitest"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { processIdentity } from "../src/container-job-processes.ts"

it.each(["attack", "restart", "crash"])("contains empty-environment orphans during %s and preserves job isolation", async mode => {
  const directory = await mkdtemp(path.join(os.homedir(), "tmp/outer-worker-"))
  const child = spawn(process.execPath, [new URL("./fixtures/outer-worker.ts", import.meta.url).pathname, directory, mode], {
    env: { ...process.env, AIRDESIGN_ISOLATION: "container" }, stdio: ["ignore", "pipe", "pipe"],
  })
  let output = "", diagnostic = ""
  child.stdout.on("data", chunk => { output += chunk.toString() })
  child.stderr.on("data", chunk => { diagnostic += chunk.toString() })
  try {
    const [code] = await once(child, "exit")
    expect(diagnostic).toBe("")
    expect(code).toBe(mode === "crash" ? 137 : 0)
    expect(output.trim()).toBe(mode === "restart" ? "recovered" : mode === "crash" ? "" : "isolated")
    const pids: number[] = JSON.parse(await readFile(path.join(directory, "pids"), "utf8"))
    expect(pids).toHaveLength(2)
    expect(pids.every(pid => processIdentity(pid) === null)).toBe(true)
    if (mode === "crash") {
      const restarted = spawn(process.execPath, [new URL("./fixtures/outer-worker.ts", import.meta.url).pathname, directory, "recovered"], {
        env: { ...process.env, AIRDESIGN_ISOLATION: "container" }, stdio: "ignore",
      })
      expect((await once(restarted, "exit"))[0]).toBe(0)
    }
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
    await rm(directory, { recursive: true, force: true })
  }
}, 20000)
