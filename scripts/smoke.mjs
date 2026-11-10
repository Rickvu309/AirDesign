import { createHash, randomBytes } from "node:crypto"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const hexCommit = /^[0-9a-f]{7,64}$/
const requestTimeoutMs = 15_000
const gitTimeoutMs = 60_000
const graceMs = 20 * 60_000
const elementName = "1.1"

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

async function fetched(url, init) {
  try {
    const reply = await fetch(url, { ...init, signal: AbortSignal.timeout(requestTimeoutMs), redirect: "manual" })
    const text = await reply.text()
    let json
    try {
      json = JSON.parse(text)
    } catch {
      json = undefined
    }
    return { status: reply.status, json, headers: reply.headers }
  } catch (error) {
    return { status: 0, json: undefined, headers: new Headers(), error: error instanceof Error ? error.name : "error" }
  }
}

function describe(reply) {
  if (reply.status === 0) return `no answer (${reply.error ?? "error"})`
  return `status ${String(reply.status)}`
}

function liveCommitOf(reply) {
  const commit = reply.json?.commit
  return reply.status === 200 && typeof commit === "string" ? commit : undefined
}

function checkLiveCommit({ git, live, settled }) {
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

function landedValues(opened) {
  const landed = opened.json?.register?.elements?.[elementName]?.landed
  return Array.isArray(landed) ? landed.map((each) => each?.value) : []
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
  const first = await fetched(`${origin}/decks/open`, jsonPost(cookie, { deck }))
  const before = first.json?.revision
  if (first.status !== 200 || first.json?.ok !== true || !Number.isInteger(before)) {
    return failure("open", `${describe(first)} ${String(first.json?.refusal ?? "")}`.trim())
  }
  const value = unique()
  const written = await fetched(
    `${origin}/decks/commit`,
    jsonPost(cookie, { deck, batch: [{ value, node: elementName }] }),
  )
  if (written.status !== 200 || written.json?.ok !== true) {
    return failure("commit", `${describe(written)} ${String(written.json?.refusal ?? "")}`.trim())
  }
  const second = await fetched(`${origin}/decks/open`, jsonPost(cookie, { deck }))
  if (second.status !== 200 || second.json?.ok !== true)
    return failure("read", `${describe(second)} ${String(second.json?.refusal ?? "")}`.trim())
  if (!landedValues(second).includes(value)) {
    return failure("read", `element ${elementName} does not hold the value that was committed`)
  }
  if (second.json.revision !== before + 1) {
    return failure("revision", `revision is ${String(second.json.revision)}, expected ${String(before + 1)}`)
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
  const result = await smoke({ origin: origin.replace(/\/+$/, ""), token: process.env.SMOKE_TOKEN })
  console.log(result.line)
  process.exit(result.ok ? 0 : 1)
}
