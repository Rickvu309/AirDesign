import { expect, it } from "vitest"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { readFileSync } from "node:fs"
import { spawn } from "node:child_process"
import { once } from "node:events"
import path from "node:path"
import os from "node:os"
import { cleanContainerJob, processIdentity } from "../src/container-job-processes.ts"
import { spawnContainerJob, killContainerJob } from "../src/container-process.ts"

function running(pid: number) {
  try { return readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1]?.[0] !== "Z" } catch { return false }
}

it("routes job files to the assigned directory", async () => {
  const directory = await mkdtemp(path.join(os.homedir(), "tmp/job-files-"))
  const program = path.join(directory, "entry.ts")
  await writeFile(program, `import {writeFile} from "node:fs/promises";import {jobPath} from ${JSON.stringify(new URL("../src/job-path.ts", import.meta.url).pathname)};await writeFile(jobPath("result.bin"),"job-result")`)
  const child = spawnContainerJob(directory, program)
  try {
    const [code] = await once(child, "exit")
    expect(code).toBe(0)
    expect(await readFile(path.join(directory, "result.bin"), "utf8")).toBe("job-result")
  } finally {
    killContainerJob(child)
    await rm(directory, { recursive: true, force: true })
  }
})

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
    }, { timeout: 5000 }).toBe(true)
    if (["cancellation", "wall-clock", "memory"].includes(action)) killContainerJob(child)
    const [code] = await exit
    if (action === "cpu") expect(code).toBe(128 + os.constants.signals.SIGXCPU)
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
    }, { timeout: 5000 }).toBe(true)
    worker.kill(signal)
    await expect.poll(() => running(pid)).toBe(false)
  } finally {
    worker.kill("SIGKILL")
    await exit
    if (pid && running(pid)) process.kill(pid, "SIGKILL")
    await rm(directory, { recursive: true, force: true })
  }
}, 10000)

it("keeps a different job alive while cleaning a detached process tree", async () => {
  const first = await mkdtemp(path.join(os.homedir(), "tmp/owned-first-"))
  const second = await mkdtemp(path.join(os.homedir(), "tmp/owned-second-"))
  const program = new URL("./fixtures/detached-job.ts", import.meta.url).pathname
  const children = [spawnContainerJob(first, program), spawnContainerJob(second, program)]
  const exits = children.map(child => once(child, "exit"))
  let otherPid = 0
  try {
    await expect.poll(async () => {
      const values = await Promise.all([first, second].map(directory => readFile(path.join(directory, "descendant"), "utf8").catch(() => "0")))
      otherPid = Number(values[1])
      return values.every(value => Number(value) > 0)
    }, { timeout: 5000 }).toBe(true)
    const child = children[0]
    if (!child) throw new Error("missing-test-job")
    killContainerJob(child)
    await exits[0]
    expect(running(otherPid)).toBe(true)
  } finally {
    for (const child of children) killContainerJob(child)
    await Promise.all(exits)
    await Promise.all([first, second].map(directory => rm(directory, { recursive: true, force: true })))
  }
})

it("stops the supervisor when recording its startup fails", async () => {
  const directory = await mkdtemp(path.join(os.homedir(), "tmp/failed-start-"))
  let pid = 0
  try {
    expect(() => spawnContainerJob(directory, new URL("./fixtures/detached-job.ts", import.meta.url).pathname, started => {
      pid = started
      throw new Error("journal-unavailable")
    })).toThrow("journal-unavailable")
    await expect.poll(() => running(pid)).toBe(false)
  } finally {
    if (pid && running(pid)) process.kill(pid, "SIGKILL")
    await rm(directory, { recursive: true, force: true })
  }
})

it.each(["normal", "cpu"])("cleans double-forked descendants with an empty environment after %s", async action => {
  const directory = await mkdtemp(path.join(os.homedir(), "tmp/empty-env-"))
  const program = path.join(directory, "entry.ts")
  await writeFile(program, `process.env.AIRDESIGN_TEST_ACTION=${JSON.stringify(action)};await import(${JSON.stringify(new URL("./fixtures/escaped-job.ts", import.meta.url).pathname)})`)
  const child = spawnContainerJob(directory, program)
  const exit = once(child, "exit")
  let pid = 0
  try {
    const [code] = await exit
    expect(code).toBe(action === "cpu" ? 128 + os.constants.signals.SIGXCPU : 0)
    pid = Number(await readFile(path.join(directory, "descendant"), "utf8"))
    expect(running(pid)).toBe(false)
  } finally {
    killContainerJob(child)
    if (pid && running(pid)) process.kill(pid, "SIGKILL")
    await rm(directory, { recursive: true, force: true })
  }
}, 10000)

it("isolates two concurrent jobs when a detached child forges the other job's marker", async () => {
  const first = await mkdtemp(path.join(os.homedir(), "tmp/forged-first-"))
  const second = await mkdtemp(path.join(os.homedir(), "tmp/forged-second-"))
  const program = path.join(first, "entry.ts")
  await writeFile(program, `process.env.AIRDESIGN_TEST_MARKER=${JSON.stringify(second)};await import(${JSON.stringify(new URL("./fixtures/escaped-job.ts", import.meta.url).pathname)})`)
  const children = [spawnContainerJob(first, program), spawnContainerJob(second, new URL("./fixtures/detached-job.ts", import.meta.url).pathname)]
  const exits = children.map(child => once(child, "exit"))
  let pid = 0
  try {
    await expect.poll(async () => {
      pid = Number(await readFile(path.join(first, "descendant"), "utf8").catch(() => "0"))
      return pid > 0 && Number(await readFile(path.join(second, "descendant"), "utf8").catch(() => "0")) > 0
    }, { timeout: 5000 }).toBe(true)
    const other = children[1]
    if (!other) throw new Error("missing-test-job")
    killContainerJob(other)
    await exits[1]
    expect(running(pid)).toBe(true)
    const owner = children[0]
    if (!owner) throw new Error("missing-test-job")
    killContainerJob(owner)
    await exits[0]
    expect(running(pid)).toBe(false)
  } finally {
    for (const child of children) killContainerJob(child)
    await Promise.all(exits)
    if (pid && running(pid)) process.kill(pid, "SIGKILL")
    await Promise.all([first, second].map(directory => rm(directory, { recursive: true, force: true })))
  }
}, 15000)

it("does not signal a reused subreaper PID with a different start time", async () => {
  const directory = await mkdtemp(path.join(os.homedir(), "tmp/stale-root-"))
  const child = spawnContainerJob(directory, new URL("./fixtures/detached-job.ts", import.meta.url).pathname)
  const exit = once(child, "exit")
  let pid = 0
  try {
    await expect.poll(async () => {
      pid = Number(await readFile(path.join(directory, "descendant"), "utf8").catch(() => "0"))
      return pid > 0
    }, { timeout: 5000 }).toBe(true)
    const root = child.pid ? processIdentity(child.pid) : null
    if (!root) throw new Error("missing-test-root")
    cleanContainerJob({ pid: root.pid, identity: "stale-start-time" })
    expect(running(root.pid)).toBe(true)
    expect(running(pid)).toBe(true)
  } finally {
    killContainerJob(child)
    await exit
    if (pid && running(pid)) process.kill(pid, "SIGKILL")
    await rm(directory, { recursive: true, force: true })
  }
})
