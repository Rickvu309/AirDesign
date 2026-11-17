import { spawn } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { newRun, removeLeftoverRuns } from "./leftover-runs.mjs"

const folders = []
const children = []
const dayAndHour = 25 * 60 * 60 * 1000

afterEach(() => {
  for (const child of children.splice(0)) child.kill("SIGKILL")
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

function scratchRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), "leftover-runs-"))
  folders.push(root)
  return root
}

function runFolder(root, run, state, ageMs) {
  const dir = path.join(root, run)
  mkdirSync(dir, { recursive: true })
  if (state !== undefined) writeFileSync(path.join(dir, "state.json"), JSON.stringify(state))
  const at = new Date(Date.now() - ageMs)
  utimesSync(dir, at, at)
  return dir
}

function deadPid() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", ""])
    child.on("error", reject)
    child.on("exit", () => resolve(child.pid))
  })
}

function sleeper(args) {
  const child = spawn(process.execPath, ["-e", "console.log('ready'); setInterval(() => {}, 1000)", "--", ...args], {
    stdio: ["ignore", "pipe", "ignore"],
  })
  children.push(child)
  return new Promise((resolve, reject) => {
    child.on("error", reject)
    child.stdout.once("data", () => resolve(child.pid))
  })
}

function stateOf(run, pid) {
  return { run, pid, postgres: { pid: 0, dataDir: "/nowhere/airdesign-api-x/data" } }
}

async function sweep(root) {
  const stopped = []
  const result = await removeLeftoverRuns({ scratchRoot: root, stop: async (run) => stopped.push(run) })
  return { stopped, result }
}

const [dead, reused, live, stateless, starting, torn] = Array.from({ length: 6 }, newRun)

describe("the leftover verify runs", () => {
  it("stops a run whose serve process is dead", async () => {
    const root = scratchRoot()
    runFolder(root, dead, stateOf(dead, await deadPid()), 0)
    const { stopped, result } = await sweep(root)
    expect(stopped).toEqual([dead])
    expect(result).toEqual({ stopped: [dead], removed: [] })
  })

  it("stops a run whose serve pid now belongs to another program", async () => {
    const root = scratchRoot()
    runFolder(root, reused, stateOf(reused, await sleeper(["serve", newRun()])), 0)
    expect((await sweep(root)).stopped).toEqual([reused])
  })

  it("keeps a run whose serve process names it", async () => {
    const root = scratchRoot()
    runFolder(root, live, stateOf(live, await sleeper(["serve", live])), dayAndHour)
    const { stopped, result } = await sweep(root)
    expect(stopped).toEqual([])
    expect(result).toEqual({ stopped: [], removed: [] })
  })

  it("removes a run folder with no state after a day", async () => {
    const root = scratchRoot()
    const dir = runFolder(root, stateless, undefined, dayAndHour)
    const { stopped, result } = await sweep(root)
    expect(stopped).toEqual([])
    expect(result.removed).toEqual([dir])
    expect(existsSync(dir)).toBe(false)
  })

  it("keeps a run folder with no state that is younger than a day", async () => {
    const root = scratchRoot()
    const dir = runFolder(root, starting, undefined, 60 * 60 * 1000)
    expect((await sweep(root)).result).toEqual({ stopped: [], removed: [] })
    expect(existsSync(dir)).toBe(true)
  })

  it("treats a state it cannot read as no state", async () => {
    const root = scratchRoot()
    const dir = runFolder(root, torn, undefined, 0)
    writeFileSync(path.join(dir, "state.json"), "{")
    expect((await sweep(root)).result).toEqual({ stopped: [], removed: [] })
  })

  it("keeps old folders that are not runs", async () => {
    const root = scratchRoot()
    const tree = runFolder(root, "tree-21fb698e0937", undefined, dayAndHour)
    expect((await sweep(root)).result).toEqual({ stopped: [], removed: [] })
    expect(existsSync(tree)).toBe(true)
  })

  it("does nothing when the scratch root does not exist", async () => {
    const root = path.join(scratchRoot(), "missing")
    expect((await sweep(root)).result).toEqual({ stopped: [], removed: [] })
  })
})
