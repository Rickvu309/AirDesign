import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

const pg = `import { spawn } from "node:child_process"
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
export async function startEmptyCluster() {
  const dir = path.join(os.homedir(), "tmp", "airdesign-api-" + String(process.pid))
  const data = path.join(dir, "data")
  mkdirSync(data, { recursive: true })
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "--", data], { detached: true, stdio: "ignore" })
  child.unref()
  writeFileSync(path.join(data, "postmaster.pid"), String(child.pid) + "\\n")
  appendFileSync(path.join(os.homedir(), "fake-postgres.pids"), String(child.pid) + "\\n")
  globalThis.fakeData = data
  return {
    port: 1,
    admin: "fake",
    stop: async () => {
      try { process.kill(child.pid, "SIGINT") } catch {}
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
`

const modules = {
  "testing/postgres-setup.js": pg,
  "platform/pool.js": `export const openPool = () => ({ query: async () => ({ rows: [{ dir: globalThis.fakeData }] }), end: async () => {} })`,
  "platform/provision.js": `
export const runBootstrap = async () => {
  if (process.env.FAKE_STACK === "hang") setInterval(() => {}, 1000), await new Promise(() => {})
  return process.env.FAKE_STACK === "bootstrap-fails" ? 1 : 0
}
export const runSetup = async () => 0`,
  "platform/listen.js": `export class DeckListen { async close() {} }`,
  "server.js": `
export const routes = []
export const createApi = () => ({ listen: (_, __, done) => done(), address: () => ({ port: 1 }), close() {}, closeAllConnections() {} })`,
  "platform/local-original-store.js": `export class LocalOriginalStore {}`,
  "platform/font-source.js": `export class FontSource { async family() { return { ok: true } } }`,
  "testing/aira-replay.js": `export class Replay { play() {} transport() {} }`,
  "aira/aira.js": `export const airaModel = "claude-fake", airaEffort = "low", airaEfforts = ["low"]`,
  "aira/anthropic-transport.js": `export const anthropicTransport = () => () => {}`,
}

function put(file, text) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
}

export function fakeStack(repo) {
  put(
    path.join(repo, "apps/api/package.json"),
    '{"name":"@airdesign/api","type":"module","exports":{".":{"import":"./dist/server.js"}}}',
  )
  for (const [file, text] of Object.entries(modules)) put(path.join(repo, "apps/api/dist", file), text)
  const catalog = path.join(repo, "packages/catalog")
  put(
    path.join(catalog, "package.json"),
    '{"name":"@airdesign/catalog","type":"module","exports":{".":{"import":"./dist/index.js"}}}',
  )
  put(
    path.join(catalog, "dist", "index.js"),
    `export const countryHeader = "x-country", signInPaths = [], signOutPaths = []`,
  )
  put(path.join(repo, "apps/web/dist/index.html"), "<title>AirDesign</title>")
  const git = (...args) =>
    execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.com", ...args])
  git("init", "-q")
  git("commit", "-q", "--allow-empty", "-m", "fake")
  return repo
}
