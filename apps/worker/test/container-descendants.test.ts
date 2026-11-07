import { expect, it } from "vitest"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { readFileSync } from "node:fs"
import { spawn } from "node:child_process"
import { once } from "node:events"
import path from "node:path"
import os from "node:os"
import { spawnContainerJob, killContainerJob } from "../src/container-process.ts"

function running(pid: number) {
  try { return readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1]?.[0] !== "Z" } catch { return false }
}

it.each(["normal", "cpu", "crash", "cancellation", "wall-clock", "memory"])("leaves no detached descendants after %s", async action => {
  const directory = await mkdtemp(path.join(os.homedir(), "tmp/descendants-"))
  const program = path.join(directory, "entry.ts")
  const { writeFile } = await import("node:fs/promises")
  await writeFile(program, `process.env.AIRDESIGN_TEST_ACTION=${JSON.stringify(action)};await import(${JSON.stringify(new URL("./fixtures/detached-job.ts", import.meta.url).pathname)})`)
  const child = spawnContainerJob(directory, program)
  const exit = once(child, "exit")
  let pid = 0
  try {
    await expect.poll(async () => {
      pid = Number(await readFile(path.join(directory, "descendant"), "utf8").catch(() => "0"))
      return pid > 0
    }).toBe(true)
    if (["cancellation", "wall-clock", "memory"].includes(action)) killContainerJob(child)
    const [code, signal] = await exit
    if (action === "cpu") expect(signal).toBe("SIGXCPU")
    if (action === "normal") expect(code).toBe(0)
    expect(running(pid)).toBe(false)
  } finally {
    killContainerJob(child)
    if (pid && running(pid)) process.kill(pid, "SIGKILL")
    await rm(directory, { recursive: true, force: true })
  }
}, 10000)

it.each(["SIGTERM", "SIGINT", "SIGKILL"] as const)("cleans detached descendants when the worker receives %s", async signal => {
  const directory = await mkdtemp(path.join(os.homedir(), "tmp/worker-descendants-"))
  const worker = spawn(process.execPath, ["--input-type=module", "-e", `
    import {spawnContainerJob} from ${JSON.stringify(new URL("../src/container-process.ts", import.meta.url).pathname)}
    spawnContainerJob(${JSON.stringify(directory)},${JSON.stringify(new URL("./fixtures/detached-job.ts", import.meta.url).pathname)})
  `], { stdio: "ignore" })
  const exit = once(worker, "exit")
  let pid = 0
  try {
    await expect.poll(async () => {
      pid = Number(await readFile(path.join(directory, "descendant"), "utf8").catch(() => "0"))
      return pid > 0
    }).toBe(true)
    worker.kill(signal)
    await expect.poll(() => running(pid)).toBe(false)
  } finally {
    worker.kill("SIGKILL")
    await exit
    if (pid && running(pid)) process.kill(pid, "SIGKILL")
    await rm(directory, { recursive: true, force: true })
  }
}, 10000)
