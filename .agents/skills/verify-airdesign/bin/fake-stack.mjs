import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

const pg = `import { execFileSync, spawn } from "node:child_process"
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import { setTimeout as pause } from "node:timers/promises"
import path from "node:path"
export async function startOwnedEmptyCluster({ dir, signal }) {
  const data = path.join(dir, "data")
  mkdirSync(data, { recursive: true })
  const fifo = path.join(data, "hold")
  execFileSync("mkfifo", [fifo])
  const postgres = path.join(os.homedir(), "postgres")
  const child = spawn(postgres, ["-c", 'read -r line <> "$1"', "postgres", fifo, "-D", data], { detached: true, stdio: "ignore" })
  writeFileSync(path.join(data, "postmaster.pid"), String(child.pid) + "\\n" + data + "\\n")
  appendFileSync(path.join(os.homedir(), "fake-postgres.pids"), String(child.pid) + "\\n")
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const ended = new Promise((resolve) => child.once("exit", resolve))
      child.kill("SIGINT")
      await ended
    }
    rmSync(dir, { recursive: true, force: true })
  }
  if (process.env.FAKE_PG_START_MS) await pause(Number(process.env.FAKE_PG_START_MS))
  if (signal.aborted || process.env.FAKE_STACK === "postgres-starting") {
    if (!signal.aborted) await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }))
    if (process.env.FAKE_PG_ABORT_MS) await pause(Number(process.env.FAKE_PG_ABORT_MS))
    await stop()
    signal.throwIfAborted()
  }
  return { port: 1, admin: "fake", stop }
}
`

const modules = {
  "testing/postgres-setup.js": pg,
  "platform/pool.js": `export const openPool = () => ({ end: async () => {} })`,
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
  put(
    path.join(repo, "apps/site/worker/sign-in-forward.ts"),
    "export const signInPagePaths = []\nexport default { fetch: () => new Response() }\n",
  )
  put(path.join(repo, "apps/web/dist/index.html"), "<title>AirDesign</title>")
  const git = (...args) =>
    execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.com", ...args])
  git("init", "-q")
  git("commit", "-q", "--allow-empty", "-m", "fake")
  return repo
}
