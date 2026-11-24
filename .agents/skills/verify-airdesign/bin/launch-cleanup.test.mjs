import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, expect, it } from "vitest"
import { alive } from "./leftover-runs.mjs"
import { fakeStack } from "./fake-stack.mjs"
import { siteCache, siteKey } from "./site.mjs"

const cli = new URL("verify-airdesign.mjs", import.meta.url).pathname
const homes = []

afterEach(() => {
  for (const home of homes.splice(0)) {
    for (const pid of strays(home)) {
      try {
        process.kill(pid, "SIGKILL")
      } catch {}
    }
    rmSync(home, { recursive: true, force: true })
  }
})

const scratchOf = (home) => path.join(home, "tmp", "verify-airdesign-scratch")

function newHome() {
  const home = mkdtempSync(path.join(os.tmpdir(), "launch-cleanup-"))
  homes.push(home)
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

function launchIn(home, repo, extra = {}) {
  return spawn(process.execPath, [cli, "launch", "--no-build"], {
    cwd: repo,
    env: { ...process.env, HOME: home, VERIFY_AIRDESIGN_REPO: repo, ...extra },
    stdio: ["ignore", "pipe", "pipe"],
  })
}

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
