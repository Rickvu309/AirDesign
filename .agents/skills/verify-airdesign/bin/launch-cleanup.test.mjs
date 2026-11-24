import { execFileSync, spawn, spawnSync } from "node:child_process"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import os from "node:os"
import path from "node:path"
import { setTimeout as pause } from "node:timers/promises"
import { afterEach, expect, it } from "vitest"
import { alive, commandLine, newRun, ownsServe, runPostgres, stateIn, writeOwner } from "./leftover-runs.mjs"
import { fakeStack } from "./fake-stack.mjs"
import { baseTree } from "./proof.mjs"
import { siteCache, siteKey } from "./site.mjs"

const cli = new URL("verify-airdesign.mjs", import.meta.url).pathname
const homes = []

function removeHome(home) {
  for (const pid of strays(home)) {
    if (!commandLine(pid).includes(home)) continue
    try {
      process.kill(pid, "SIGKILL")
    } catch {}
  }
  rmSync(home, { recursive: true, force: true })
}

afterEach(() => {
  for (const home of homes.splice(0)) removeHome(home)
})

const scratchOf = (home) => path.join(home, "tmp", "verify-airdesign-scratch")

function newHome(onTestFinished) {
  const home = mkdtempSync(path.join(os.tmpdir(), "launch-cleanup-"))
  if (onTestFinished) onTestFinished(() => removeHome(home))
  else homes.push(home)
  copyFileSync("/bin/sh", path.join(home, "postgres"))
  return home
}

function postgresPids(home) {
  const file = path.join(home, "fake-postgres.pids")
  return existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").map(Number) : []
}

function strays(home) {
  const scratch = scratchOf(home)
  const runs = existsSync(scratch) ? readdirSync(scratch).filter((name) => /Z-[0-9a-f]{6}$/.test(name)) : []
  const servers = runs.flatMap((run) => {
    try {
      return [JSON.parse(readFileSync(path.join(scratch, run, "state.json"), "utf8")).pid]
    } catch {
      return []
    }
  })
  return [...servers, ...postgresPids(home)]
}

const runsLeft = (home) =>
  existsSync(scratchOf(home)) ? readdirSync(scratchOf(home)).filter((name) => /Z-[0-9a-f]{6}$/.test(name)) : []

function withSite(home, repo) {
  const cached = siteCache(siteKey(repo), path.join(home, "tmp", "verify-airdesign-cache"))
  mkdirSync(cached, { recursive: true })
  writeFileSync(path.join(cached, "index.html"), "<title>site</title>")
}

function runIn(home, repo, args, extra = {}) {
  return spawn(process.execPath, [cli, ...args], {
    cwd: repo,
    env: { ...process.env, HOME: home, VERIFY_AIRDESIGN_REPO: repo, ...extra },
    stdio: ["ignore", "pipe", "pipe"],
  })
}

const launchIn = (home, repo, extra) => runIn(home, repo, ["launch", "--no-build"], extra)

function finished(child) {
  return new Promise((resolve) => {
    let stderr = ""
    let stdout = ""
    child.stdout.on("data", (chunk) => (stdout += chunk))
    child.stderr.on("data", (chunk) => (stderr += chunk))
    child.on("close", (status) => resolve({ status, stdout, stderr }))
  })
}

const until = async (check, ms = 20_000) => {
  for (let waited = 0; waited < ms; waited += 100) {
    if (check()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error("timed out")
}

const allDead = (pids) => pids.every((pid) => !alive(pid))

it("leaves no Postgres and no run folder when a base launch fails after Postgres starts", async () => {
  const home = newHome()
  const tree = fakeStack(path.join(scratchOf(home), "tree-abc123"))
  withSite(home, tree)
  const done = await finished(
    launchIn(home, tree, { FAKE_STACK: "bootstrap-fails", VERIFY_AIRDESIGN_OWNER: "/work/caller" }),
  )
  expect(done.status).toBe(1)
  expect(postgresPids(home)).toHaveLength(1)
  expect(allDead(postgresPids(home))).toBe(true)
  expect(runsLeft(home)).toEqual([])
})

it("leaves no run folder when the site build fails", async () => {
  const home = newHome()
  const repo = fakeStack(path.join(home, "work"))
  const done = await finished(launchIn(home, repo))
  expect(done.status).toBe(1)
  expect(runsLeft(home)).toEqual([])
})

it("leaves no Postgres and no run folder when a launch is interrupted before it is ready", async () => {
  const home = newHome()
  const repo = fakeStack(path.join(home, "work"))
  withSite(home, repo)
  const child = launchIn(home, repo, { FAKE_STACK: "hang" })
  const done = finished(child)
  await until(() => postgresPids(home).length === 1)
  const [postgres] = postgresPids(home)
  child.kill("SIGINT")
  expect((await done).status).toBe(1)
  expect(alive(postgres)).toBe(false)
  expect(runsLeft(home)).toEqual([])
})

it("starts a stack that its own worktree stops, leaving nothing", async () => {
  const home = newHome()
  const repo = fakeStack(path.join(home, "work"))
  withSite(home, repo)
  const launched = await finished(launchIn(home, repo))
  expect(launched.status).toBe(0)
  const { run } = JSON.parse(launched.stdout.trim().split("\n").at(-1))
  const postgres = postgresPids(home)
  expect(postgres).toHaveLength(1)
  const stopped = spawnSync(process.execPath, [cli, "stop", run], {
    encoding: "utf8",
    env: { ...process.env, HOME: home, VERIFY_AIRDESIGN_REPO: repo },
  })
  expect(stopped.status).toBe(0)
  expect(allDead(postgres)).toBe(true)
  expect(runsLeft(home)).toEqual([])
})

function comparison(home, repo, command) {
  const git = (...args) =>
    execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
      encoding: "utf8",
    }).trim()
  mkdirSync(path.join(repo, "scripts"))
  writeFileSync(
    path.join(repo, "scripts/machine-lock.mjs"),
    "export const takeMachineLock = async () => () => {}\nexport const takeSpeedLock = takeMachineLock",
  )
  git("add", "-f", "apps", "packages", "scripts")
  git("commit", "-m", "fake base")
  const base = git("rev-parse", "HEAD")
  const tree = baseTree(repo, base, [], scratchOf(home))
  mkdirSync(path.join(tree, "node_modules"))
  writeFileSync(`${tree}.built`, base)
  withSite(home, tree)
  const callouts = path.join(home, "callouts.json")
  writeFileSync(callouts, JSON.stringify([{ state: "home-wide", title: "Home", callouts: [] }]))
  const args = command === "before-after" ? [command, callouts] : [command, "--runs", "2"]
  return { tree, args: [...args, "--base", base] }
}

const commands = ["launch", "before-after", "bench"]

it.concurrent.for(commands.flatMap((command) => [0, 50, 500].map((delay) => [command, delay])))(
  "stops Postgres during %s startup with repeat SIGINT delay %i ms",
  async ([command, delay], { onTestFinished }) => {
    const home = newHome(onTestFinished)
    const repo = fakeStack(path.join(home, "work"))
    withSite(home, repo)
    const { args, tree } = command === "launch" ? { args: ["launch", "--no-build"] } : comparison(home, repo, command)
    const child = runIn(home, repo, args, { FAKE_STACK: "postgres-starting", FAKE_PG_ABORT_MS: "1000" })
    const done = finished(child)
    await until(() => postgresPids(home).length === 1)
    const [pid] = postgresPids(home)
    const [run] = runsLeft(home)
    const starting = stateIn(path.join(scratchOf(home), run))
    const dataDir = runPostgres(path.join(scratchOf(home), run)).dataDir
    await until(() => commandLine(pid).includes(dataDir))
    child.kill("SIGINT")
    if (delay !== 0) {
      await pause(delay)
      expect(child.kill("SIGINT")).toBe(true)
    }
    const result = await done
    expect(result.status, result.stderr).toBe(1)
    if (delay !== 0) expect(result.stderr).toContain("cleanup is in progress")
    expect(ownsServe(starting)).toBe(false)
    expect(alive(pid)).toBe(false)
    expect(starting).toMatchObject({
      ready: false,
      postgres: { dataDir, pidFile: path.join(dataDir, "postmaster.pid") },
    })
    expect(existsSync(dataDir)).toBe(false)
    expect(runsLeft(home)).toEqual([])
    expect(readdirSync(scratchOf(home))).toEqual([])
    if (tree !== undefined) {
      const worktrees = execFileSync("git", ["-C", repo, "worktree", "list", "--porcelain"], { encoding: "utf8" })
      expect(worktrees).not.toContain(tree)
    }
  },
  30_000,
)

it("stops the registered Postgres when serve exits before handing back its stop handle", async () => {
  const home = newHome()
  const repo = fakeStack(path.join(home, "work"))
  withSite(home, repo)
  const done = finished(launchIn(home, repo, { FAKE_STACK: "postgres-starting" }))
  await until(() => postgresPids(home).length === 1)
  const [run] = runsLeft(home)
  const state = stateIn(path.join(scratchOf(home), run))
  expect(ownsServe(state)).toBe(true)
  process.kill(state.pid, "SIGKILL")
  const result = await done
  expect(result.status, result.stderr).toBe(1)
  expect(alive(postgresPids(home)[0])).toBe(false)
  expect(runsLeft(home)).toEqual([])
})

it("ignores a foreign Postgres PID in its own run's pid file", async () => {
  const home = newHome()
  const repo = fakeStack(path.join(home, "work"))
  const foreign = fakeStack(path.join(home, "foreign"))
  withSite(home, foreign)
  const launched = await finished(launchIn(home, foreign))
  expect(launched.status).toBe(0)
  const { run: foreignRun } = JSON.parse(launched.stdout)
  const [pid] = postgresPids(home)
  try {
    const run = newRun()
    const dir = path.join(scratchOf(home), run)
    const postgres = runPostgres(dir)
    mkdirSync(postgres.dataDir, { recursive: true })
    writeOwner(dir, repo)
    writeFileSync(path.join(dir, "state.json"), JSON.stringify({ run, repo, postgres, ready: false }))
    writeFileSync(postgres.pidFile, `${String(pid)}\n${postgres.dataDir}\n`)
    expect((await finished(runIn(home, repo, ["stop", run]))).status).toBe(1)
    expect(alive(pid)).toBe(true)
    expect(runsLeft(home)).toEqual([foreignRun, run].sort())
    expect(existsSync(stateIn(path.join(scratchOf(home), foreignRun)).postgres.dataDir)).toBe(true)
  } finally {
    expect((await finished(runIn(home, foreign, ["stop", foreignRun]))).status).toBe(0)
  }
})

it("rolls back a launch whose pg_ctl start would take 25 seconds", async () => {
  const home = newHome()
  const repo = fakeStack(path.join(home, "work"))
  withSite(home, repo)
  const child = launchIn(home, repo, { FAKE_PG_START_MS: "25000" })
  const done = finished(child)
  await until(() => postgresPids(home).length === 1)
  const [run] = runsLeft(home)
  const state = stateIn(path.join(scratchOf(home), run))
  const [postgres] = postgresPids(home)
  await until(() => commandLine(postgres).includes(state.postgres.dataDir))
  child.kill("SIGINT")
  const result = await done
  expect(result.status, result.stderr).toBe(1)
  expect(ownsServe(state)).toBe(false)
  expect(alive(postgres)).toBe(false)
  expect(readdirSync(scratchOf(home))).toEqual([])
}, 30_000)

it("lets serve exit when its Postgres and scratch directory are already gone", async () => {
  const home = newHome()
  const repo = fakeStack(path.join(home, "work"))
  withSite(home, repo)
  const launched = await finished(launchIn(home, repo))
  expect(launched.status).toBe(0)
  const { run } = JSON.parse(launched.stdout)
  const state = stateIn(path.join(scratchOf(home), run))
  const [postgres] = postgresPids(home)
  process.kill(postgres, "SIGINT")
  await until(() => !alive(postgres))
  rmSync(path.join(scratchOf(home), run), { recursive: true })
  process.kill(state.pid, "SIGTERM")
  try {
    await until(() => !ownsServe(state), 2000)
  } finally {
    if (ownsServe(state)) process.kill(state.pid, "SIGKILL")
  }
})

it("keeps a run when its pid file points to a non-Postgres process using its exact data directory", async () => {
  const home = newHome()
  const repo = fakeStack(path.join(home, "work"))
  const run = newRun()
  const dir = path.join(scratchOf(home), run)
  const postgres = runPostgres(dir)
  mkdirSync(postgres.dataDir, { recursive: true })
  writeOwner(dir, repo)
  writeFileSync(path.join(dir, "state.json"), JSON.stringify({ run, repo, postgres, ready: false }))
  const unrelated = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "--", "-D", postgres.dataDir])
  const ended = new Promise((resolve) => unrelated.once("exit", resolve))
  try {
    await until(() => commandLine(unrelated.pid).includes(postgres.dataDir))
    writeFileSync(postgres.pidFile, `${unrelated.pid}\n${postgres.dataDir}\n`)
    const result = await finished(runIn(home, repo, ["stop", run]))
    expect(result.status).toBe(1)
    expect(alive(unrelated.pid)).toBe(true)
    expect(existsSync(postgres.pidFile)).toBe(true)
    expect(runsLeft(home)).toEqual([run])
  } finally {
    unrelated.kill("SIGKILL")
    await ended
  }
})
