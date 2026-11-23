import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, it } from "vitest"
import { driverFor } from "../look/before-after.mjs"
import { baseTree, carried } from "./proof.mjs"

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
