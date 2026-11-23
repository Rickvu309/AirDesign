import { createHash, randomBytes } from "node:crypto"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const hexCommit = /^[0-9a-f]{7,64}$/
const requestTimeoutMs = 15_000
const gitTimeoutMs = 60_000
const graceMs = 20 * 60_000
const deckNode = "s:1"
export const studioOrigin = "https://studio.airdesign.app"

export function deckIdFor(token) {
  return `smoke-${createHash("sha256").update(`smoke-deck:${token}`).digest("hex").slice(0, 32)}`
}

export function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8", timeout: gitTimeoutMs })
  return { status: result.status ?? 1, stdout: result.stdout ?? "" }
}

function failure(step, got) {
  return { ok: false, line: `smoke failed at ${step}: ${got}` }
}

export async function fetched(url, init) {
  try {
    const reply = await fetch(url, { ...init, signal: AbortSignal.timeout(requestTimeoutMs), redirect: "manual" })
    const text = await reply.text()
    let json
    try {
      json = JSON.parse(text)
    } catch {
      json = undefined
    }
    return { status: reply.status, text, json, headers: reply.headers }
  } catch (error) {
    return {
      status: 0,
      text: "",
      json: undefined,
      headers: new Headers(),
      error: error instanceof Error ? error.name : "error",
    }
  }
}

function describe(reply) {
  if (reply.status === 0) return `no answer (${reply.error ?? "error"})`
  return `status ${String(reply.status)}`
}

export function liveCommitOf(reply) {
  const commit = reply.json?.commit
  return reply.status === 200 && typeof commit === "string" ? commit : undefined
}

export function checkLiveCommit({ git, live, settled }) {
  if (live === undefined || !hexCommit.test(live)) {
    return failure("version", `the API reports ${live === undefined ? "no commit" : "commit unknown"}`)
  }
  if (settled === undefined || live === settled) return { ok: true }
  if (git(["cat-file", "-e", `${live}^{commit}`]).status !== 0) {
    return failure("version", `live commit ${live.slice(0, 12)} is unknown to git after fetching main`)
  }
  if (git(["merge-base", "--is-ancestor", settled, live]).status !== 0) {
    return failure("version", `live commit ${live.slice(0, 12)} does not contain ${settled.slice(0, 12)}`)
  }
  return { ok: true }
}

function settledCommit({ git, now }) {
  git(["fetch", "origin", "main"])
  const listed = git(["rev-list", "-1", `--before=${String(Math.floor((now() - graceMs) / 1000))}`, "origin/main"])
  if (listed.status !== 0) return { error: failure("version", "git could not read origin/main") }
  const commit = listed.stdout.trim()
  if (commit === "") return {}
  if (!hexCommit.test(commit)) return { error: failure("version", "git named no commit on origin/main") }
  return { commit }
}

function jsonPost(cookie, body) {
  return {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie === undefined ? {} : { cookie }) },
    body: JSON.stringify(body),
  }
}

function cookiePair(reply) {
  const first = reply.headers.getSetCookie()[0]
  return first === undefined ? undefined : first.split(";")[0]
}

function deckNameOf(opened) {
  return opened.json?.fold?.nodes?.[deckNode]?.name
}

export async function studio({ origin = studioOrigin }) {
  const page = await fetched(`${origin}/`)
  if (page.status !== 200) return failure("studio-page", describe(page))
  const html = (page.headers.get("content-type") ?? "").startsWith("text/html")
  if (!html || !page.text.includes('<div id="root">')) {
    return failure("studio-page", "the answer is not the web app's page")
  }
  const metadata = await fetched(`${origin}/.well-known/oauth-protected-resource`)
  if (metadata.status !== 200) return failure("studio-resource", describe(metadata))
  if (metadata.json?.resource !== `${origin}/mcp`) {
    return failure("studio-resource", `the resource is ${String(metadata.json?.resource)}, expected ${origin}/mcp`)
  }
  const mcp = await fetched(`${origin}/mcp`, { method: "POST" })
  if (mcp.status !== 401) return failure("studio-mcp", describe(mcp))
  if (!(mcp.headers.get("www-authenticate") ?? "").includes("resource_metadata=")) {
    return failure("studio-mcp", "the 401 names no resource_metadata")
  }
  return { ok: true, line: "web app passed: page, protected resource and MCP challenge" }
}

export async function smoke({
  origin,
  token,
  git = runGit,
  now = Date.now,
  unique = () => `smoke-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`,
}) {
  if (typeof token !== "string" || token.length === 0) return failure("setup", "SMOKE_TOKEN is not set")
  const settled = settledCommit({ git, now })
  if (settled.error !== undefined) return settled.error
  const version = await fetched(`${origin}/version`)
  const live = liveCommitOf(version)
  if (live === undefined && version.status !== 200) return failure("version", describe(version))
  const matched = checkLiveCommit({ git, live, settled: settled.commit })
  if (!matched.ok) return matched
  const health = await fetched(`${origin}/health`)
  if (health.status !== 200) return failure("health", describe(health))
  const deck = deckIdFor(token)
  const session = await fetched(`${origin}/smoke/session`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  })
  const cookie = cookiePair(session)
  if (session.status !== 200 || session.json?.ok !== true || cookie === undefined) {
    return failure("session", cookie === undefined && session.status === 200 ? "no session cookie" : describe(session))
  }
  const first = await fetched(`${origin}/doom/create`, jsonPost(cookie, { deck }))
  const before = first.json?.rev
  if (first.status !== 200 || first.json?.ok !== true || !Number.isInteger(before)) {
    return failure("open", `${describe(first)} ${String(first.json?.refusal ?? "")}`.trim())
  }
  const value = unique()
  const edit = {
    once: value,
    author: { kind: "person", id: "smoke" },
    writes: [{ node: deckNode, prop: "name", value }],
  }
  const written = await fetched(`${origin}/doom/edit`, jsonPost(cookie, { deck, edit }))
  if (written.status !== 200 || written.json?.ok !== true) {
    return failure("edit", `${describe(written)} ${String(written.json?.refusal ?? "")}`.trim())
  }
  const second = await fetched(`${origin}/doom/open`, jsonPost(cookie, { deck }))
  if (second.status !== 200 || second.json?.ok !== true)
    return failure("read", `${describe(second)} ${String(second.json?.refusal ?? "")}`.trim())
  if (deckNameOf(second) !== value) {
    return failure("read", "the deck name is not the value that was written")
  }
  if (second.json.rev !== before + 1) {
    return failure("revision", `revision is ${String(second.json.rev)}, expected ${String(before + 1)}`)
  }
  return {
    ok: true,
    line: `smoke passed: live commit ${live.slice(0, 12)}, revision ${String(before + 1)} read back`,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [origin] = process.argv.slice(2)
  if (!origin) {
    console.log("smoke failed at setup: usage is node scripts/smoke.mjs <origin>")
    process.exit(1)
  }
  const api = await smoke({ origin: origin.replace(/\/+$/, ""), token: process.env.SMOKE_TOKEN })
  const web = await studio({ origin: studioOrigin })
  const failed = [api, web].find((result) => !result.ok)
  console.log(failed?.line ?? `${api.line}; ${web.line}`)
  process.exit(failed === undefined ? 0 : 1)
}
