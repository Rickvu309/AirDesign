import { spawn, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { removeLeftoverClusters } from "./leftover-clusters.js"

const folders: string[] = []
const children: ChildProcess[] = []
const hourAndMinute = 61 * 60 * 1000

afterEach(async () => {
  for (const child of children.splice(0)) child.kill("SIGKILL")
  await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })))
})

async function tmpRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "leftover-clusters-"))
  folders.push(root)
  return root
}

async function cluster(root: string, name: string, pid: number | null, ageMs: number): Promise<string> {
  const dir = path.join(root, name)
  await mkdir(path.join(dir, "data"), { recursive: true })
  if (pid !== null) await writeFile(path.join(dir, "data/postmaster.pid"), `${String(pid)}\n${dir}/data\n`)
  const at = new Date(Date.now() - ageMs)
  await utimes(dir, at, at)
  return dir
}

function deadPid(): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", ""])
    child.on("error", reject)
    child.on("exit", () => {
      if (child.pid === undefined) reject(new Error("no pid"))
      else resolve(child.pid)
    })
  })
}

function sleeper(args: readonly string[], cwd?: string): Promise<number> {
  const child = spawn(process.execPath, ["-e", "console.log('ready'); setInterval(() => {}, 1000)", "--", ...args], {
    cwd,
    stdio: ["ignore", "pipe", "ignore"],
  })
  children.push(child)
  return new Promise((resolve, reject) => {
    child.on("error", reject)
    child.stdout.once("data", () => {
      if (child.pid === undefined) reject(new Error("no pid"))
      else resolve(child.pid)
    })
  })
}

describe("the leftover test clusters", () => {
  it("removes an old cluster whose postmaster is dead", async () => {
    const root = await tmpRoot()
    const dir = await cluster(root, "airdesign-api-dead01", await deadPid(), hourAndMinute)
    expect(await removeLeftoverClusters(root)).toEqual([dir])
    expect(existsSync(dir)).toBe(false)
  })

  it("removes an old cluster that never wrote a postmaster pid", async () => {
    const root = await tmpRoot()
    const dir = await cluster(root, "airdesign-api-nopid1", null, hourAndMinute)
    expect(await removeLeftoverClusters(root)).toEqual([dir])
  })

  it("removes an old cluster whose pid now belongs to another program", async () => {
    const root = await tmpRoot()
    const dir = await cluster(root, "airdesign-api-reuse1", await sleeper([]), hourAndMinute)
    expect(await removeLeftoverClusters(root)).toEqual([dir])
  })

  it("keeps a cluster whose postmaster names its folder", async () => {
    const root = await tmpRoot()
    const dir = path.join(root, "airdesign-api-alive1")
    const pid = await sleeper(["-D", path.join(dir, "data")])
    await cluster(root, "airdesign-api-alive1", pid, hourAndMinute)
    expect(await removeLeftoverClusters(root)).toEqual([])
    expect(existsSync(dir)).toBe(true)
  })

  it("keeps a dead cluster a live process still works in", async () => {
    const root = await tmpRoot()
    const dir = await cluster(root, "airdesign-api-inuse1", await deadPid(), hourAndMinute)
    await sleeper([], path.join(dir, "data"))
    expect(await removeLeftoverClusters(root)).toEqual([])
  })

  it("keeps a dead cluster made within the hour", async () => {
    const root = await tmpRoot()
    await cluster(root, "airdesign-api-young1", await deadPid(), 10 * 60 * 1000)
    expect(await removeLeftoverClusters(root)).toEqual([])
  })

  it("keeps folders that are not test clusters", async () => {
    const root = await tmpRoot()
    await cluster(root, "verify-airdesign", await deadPid(), hourAndMinute)
    expect(await removeLeftoverClusters(root)).toEqual([])
  })
})
