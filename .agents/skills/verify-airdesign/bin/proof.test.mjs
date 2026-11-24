import { execFileSync, spawn } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, it } from "vitest"
import { driverFor } from "../look/before-after.mjs"
import { alive } from "./leftover-runs.mjs"
import { baseTree, carried, cleaning, newCleanup, stackFor } from "./proof.mjs"

const skill = ".agents/skills/verify-airdesign"
const streams = "apps/api/src/testing/aira-streams"

const registry = `import { readdirSync } from "node:fs"
const folder = new URL("./states/", import.meta.url)
const files = readdirSync(folder).filter((file) => file.endsWith(".mjs")).sort()
export const states = await Promise.all(files.map(async (file) => (await import(new URL(file, folder).href)).default))
export const find = (name) => states.find((each) => each.name === name)
export const reach = (state, kit) => state.drive(kit)
`

const headOnlyState = `import path from "node:path"
import { pathToFileURL } from "node:url"
export default {
  name: "carried-only",
  drive: async ({ journeys, seen }) => {
    const { step } = await import(pathToFileURL(path.join(journeys, "kept.mjs")).href)
    seen.push(step)
  },
}
`

function put(root, file, text) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  writeFileSync(path.join(root, file), text)
}

function repoWithBase() {
  const repo = mkdtempSync(path.join(tmpdir(), "carry-repo-"))
  const git = (...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim()
  git("init", "-q")
  put(repo, `${skill}/look/states.mjs`, registry)
  put(repo, `${skill}/look/states/kept.mjs`, 'export default { name: "kept", drive: async () => {} }\n')
  put(repo, `${skill}/journeys/kept.mjs`, 'export const step = "kept journey"\n')
  put(repo, `${streams}/kept.sse`, "data: {}\n\n")
  put(repo, "apps/web/src/product.ts", "export const shipped = 1\n")
  git("add", "-A")
  git("-c", "user.name=base", "-c", "user.email=base@example.com", "commit", "-q", "-m", "base")
  return { repo, git, base: git("rev-parse", "HEAD") }
}

function changeOnHead(repo) {
  put(repo, `${skill}/look/states/carried-only.mjs`, headOnlyState)
  put(repo, `${skill}/journeys/kept.mjs`, 'export const step = "kept journey, new step"\n')
  put(repo, `${streams}/kept.sse`, "data: {}\n\ndata: {}\n\n")
  put(repo, `${streams}/carried.sse`, "data: {}\n\n")
  put(repo, "apps/web/src/product.ts", "export const shipped = 2\n")
}

const carriedFiles = [
  `${skill}/journeys/kept.mjs`,
  `${skill}/look/states/carried-only.mjs`,
  `${streams}/carried.sse`,
  `${streams}/kept.sse`,
]

it("captures a state that exists only on the head, through the head's new journey step, on a base that carries the head's look, journeys and streams uncommitted", async () => {
  const { repo, base } = repoWithBase()
  changeOnHead(repo)
  const carry = carried(repo, base)
  const dir = baseTree(repo, base, carry, mkdtempSync(path.join(tmpdir(), "carry-scratch-")))
  const driver = await driverFor(dir, carry)
  const seen = []
  await driver.reach("carried-only")({ seen })
  expect(seen).toEqual(["kept journey, new step"])
  expect(carry.map(({ file }) => file)).toEqual(carriedFiles)
  expect(readFileSync(path.join(dir, streams, "kept.sse"), "utf8")).toBe("data: {}\n\ndata: {}\n\n")
  expect(readFileSync(path.join(dir, "apps/web/src/product.ts"), "utf8")).toBe("export const shipped = 1\n")
  expect(execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()).toBe(base)
})

it("still calls a carried state new when the base cannot reach it, and an old one failed", async () => {
  const { repo, base } = repoWithBase()
  changeOnHead(repo)
  const carry = carried(repo, base)
  const driver = await driverFor(baseTree(repo, base, carry, mkdtempSync(path.join(tmpdir(), "carry-scratch-"))), carry)
  expect(driver.lacks("carried-only")).toBe(true)
  expect(driver.lacks("kept")).toBe(false)
})

it("carries a head commit's changes the same as the working tree's", () => {
  const { repo, git, base } = repoWithBase()
  changeOnHead(repo)
  git("add", "-A")
  git("-c", "user.name=head", "-c", "user.email=head@example.com", "commit", "-q", "-m", "head")
  put(repo, `${streams}/kept.sse`, "uncommitted\n")
  const carry = carried(repo, base, "HEAD")
  expect(carry.map(({ file }) => file)).toEqual(carriedFiles)
  expect(carry.find(({ file }) => file.endsWith("kept.sse")).bytes.toString()).toBe("data: {}\n\ndata: {}\n\n")
})

it("builds the plain base tree when there is nothing to carry, and a tree of its own for each carry", () => {
  const { repo, base } = repoWithBase()
  const scratch = mkdtempSync(path.join(tmpdir(), "carry-scratch-"))
  expect(path.basename(baseTree(repo, base, [], scratch))).toBe(`tree-${base.slice(0, 12)}`)
  changeOnHead(repo)
  const carriedDir = baseTree(repo, base, carried(repo, base), scratch)
  expect(path.basename(carriedDir)).toMatch(new RegExp(`^tree-${base.slice(0, 12)}-[0-9a-f]{10}$`))
})

const started = (run) => (repo, _build, cleanup) => {
  cleanup.runs.push({ run, repo })
  return Promise.resolve(run)
}

function failingBaseRun(failure) {
  const { repo, base } = repoWithBase()
  const root = mkdtempSync(path.join(tmpdir(), "carry-scratch-"))
  const cleanup = newCleanup()
  const stopped = []
  const attempt = () =>
    cleaning({
      cleanup,
      runtime: { repo },
      stop: (run, at) => stopped.push([run, at]),
      body: () =>
        stackFor({
          ref: base,
          runtime: { repo },
          cleanup,
          root,
          install: failure.install ?? (() => {}),
          launch: failure.launch ?? started("run-base"),
          mark: failure.mark ?? (() => {}),
        }),
    })
  return { repo, root, stopped, attempt }
}

it.each([
  [
    "the ready marker cannot be written",
    {
      mark: () => {
        throw new Error("injected marker failure")
      },
    },
    true,
  ],
  [
    "the install fails",
    {
      install: () => {
        throw new Error("injected install failure")
      },
    },
    false,
  ],
  [
    "the launch fails",
    {
      launch: () => Promise.reject(new Error("injected launch failure")),
    },
    false,
  ],
])(
  "stops the base run it started, as the tree that owns it, and removes the scratch tree when %s",
  async (_, failure, ran) => {
    const { repo, root, stopped, attempt } = failingBaseRun(failure)
    await expect(attempt()).rejects.toThrow("injected")
    expect(stopped).toEqual(ran ? [["run-base", expect.stringContaining("tree-")]] : [])
    expect(existsSync(root) ? readdirSync(root) : []).toEqual([])
    expect(execFileSync("git", ["-C", repo, "worktree", "list"], { encoding: "utf8" }).trim().split("\n")).toHaveLength(
      1,
    )
  },
)

it("keeps what it started only when the work succeeded and it was asked to", async () => {
  const { repo } = repoWithBase()
  const cleanup = newCleanup()
  const stopped = []
  const run = (keep, body) => cleaning({ cleanup, keep, runtime: { repo }, stop: (name) => stopped.push(name), body })
  cleanup.runs.push({ run: "kept", repo })
  await run(true, async () => {})
  expect(stopped).toEqual([])
  await expect(
    run(true, async () => {
      throw new Error("boom")
    }),
  ).rejects.toThrow("boom")
  expect(stopped).toEqual(["kept"])
})

it("stops what it started and ends a launch in flight when interrupted", async () => {
  const { repo } = repoWithBase()
  const marker = path.join(mkdtempSync(path.join(tmpdir(), "interrupt-")), "stopped")
  const script = `
    import { spawn } from "node:child_process"
    import { appendFileSync } from "node:fs"
    import { cleaning, newCleanup } from ${JSON.stringify(new URL("proof.mjs", import.meta.url).href)}
    const cleanup = newCleanup()
    cleanup.runs.push({ run: "base-run", repo: "/scratch/tree-x" })
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" })
    const ended = new Promise((resolve) => child.on("close", resolve))
    cleanup.launching.add({ child, ended })
    appendFileSync(${JSON.stringify(marker)}, "launching " + child.pid + "\\n")
    try {
      await cleaning({
        cleanup,
        runtime: { repo: ${JSON.stringify(repo)} },
        stop: (run, at) => appendFileSync(${JSON.stringify(marker)}, "stopped " + run + " " + at + "\\n"),
        body: () => new Promise(() => setInterval(() => {}, 1000)),
      })
    } catch (error) {
      appendFileSync(${JSON.stringify(marker)}, String(error.message) + "\\n")
      process.exit(2)
    }
  `
  const child = spawn(process.execPath, ["--input-type=module", "-e", script], { stdio: "ignore" })
  const closed = new Promise((resolve) => child.on("close", resolve))
  for (let waited = 0; waited < 20_000 && !existsSync(marker); waited += 100)
    await new Promise((resolve) => setTimeout(resolve, 100))
  await new Promise((resolve) => setTimeout(resolve, 500))
  child.kill("SIGINT")
  expect(await closed).toBe(2)
  const lines = readFileSync(marker, "utf8").trim().split("\n")
  expect(lines.slice(1)).toEqual(["stopped base-run /scratch/tree-x", "interrupted by SIGINT"])
  expect(alive(Number(lines[0].split(" ")[1]))).toBe(false)
})
