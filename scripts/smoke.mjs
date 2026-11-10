import { randomBytes } from "node:crypto"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const hexCommit = /^[0-9a-f]{7,64}$/
const requestTimeoutMs = 15_000
const defaultPollLimitMs = 15 * 60_000
const defaultPollMs = 10_000
const deckName = "smoke"
const elementName = "1.1"

export function containsCommit(commit, live) {
  if (live === commit) return true
  if (!hexCommit.test(commit) || !hexCommit.test(live)) return false
  const result = spawnSync("git", ["merge-base", "--is-ancestor", commit, live], { stdio: "ignore" })
  return result.status === 0
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

async function pause(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForCommit({ origin, commit, contains, pollMs, pollLimitMs }) {
  const started = performance.now()
  let seen = "nothing"
  for (;;) {
    const reply = await fetched(`${origin}/version`)
    const live = liveCommitOf(reply)
    if (live === undefined) seen = describe(reply)
    else if (contains(commit, live)) return { ok: true }
    else seen = `commit ${hexCommit.test(live) ? live.slice(0, 12) : "unknown"}`
    if (performance.now() - started + pollMs > pollLimitMs) {
      return failure("version", `${seen} is live, not ${commit.slice(0, 12)} or a commit that contains it`)
    }
    await pause(pollMs)
  }
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
  commit,
  token,
  contains = containsCommit,
  pollMs = defaultPollMs,
  pollLimitMs = defaultPollLimitMs,
  unique = () => `smoke-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`,
}) {
  if (typeof token !== "string" || token.length === 0) return failure("setup", "SMOKE_TOKEN is not set")
  const live = await waitForCommit({ origin, commit, contains, pollMs, pollLimitMs })
  if (!live.ok) return live
  const health = await fetched(`${origin}/health`)
  if (health.status !== 200) return failure("health", describe(health))
  const session = await fetched(`${origin}/smoke/session`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  })
  const cookie = cookiePair(session)
  if (session.status !== 200 || session.json?.ok !== true || cookie === undefined) {
    return failure("session", cookie === undefined && session.status === 200 ? "no session cookie" : describe(session))
  }
  const first = await fetched(`${origin}/decks/open`, jsonPost(cookie, { deck: deckName }))
  const before = first.json?.revision
  if (first.status !== 200 || first.json?.ok !== true || !Number.isInteger(before)) {
    return failure("open", describe(first))
  }
  const value = unique()
  const written = await fetched(
    `${origin}/decks/commit`,
    jsonPost(cookie, { deck: deckName, batch: [{ value, node: elementName }] }),
  )
  if (written.status !== 200 || written.json?.ok !== true) {
    return failure("commit", `${describe(written)} ${String(written.json?.refusal ?? "")}`.trim())
  }
  const second = await fetched(`${origin}/decks/open`, jsonPost(cookie, { deck: deckName }))
  if (second.status !== 200 || second.json?.ok !== true) return failure("read", describe(second))
  if (!landedValues(second).includes(value)) {
    return failure("read", `element ${elementName} does not hold the value that was committed`)
  }
  if (second.json.revision !== before + 1) {
    return failure("revision", `revision is ${String(second.json.revision)}, expected ${String(before + 1)}`)
  }
  return { ok: true, line: `smoke passed: commit ${commit.slice(0, 12)} is live, revision ${String(before + 1)} read back` }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [origin, commit] = process.argv.slice(2)
  if (!origin || !commit) {
    console.log("smoke failed at setup: usage is node scripts/smoke.mjs <origin> <commit>")
    process.exit(1)
  }
  const result = await smoke({ origin: origin.replace(/\/+$/, ""), commit, token: process.env.SMOKE_TOKEN })
  console.log(result.line)
  process.exit(result.ok ? 0 : 1)
}
