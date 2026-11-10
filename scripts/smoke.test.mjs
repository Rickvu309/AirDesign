import { execFileSync } from "node:child_process"
import { createServer } from "node:http"
import { containsCommit, smoke } from "./smoke.mjs"

const token = "secret-token-for-the-fake"
const cookieValue = "airdesign.session=secret-cookie-for-the-fake"
const commit = "a".repeat(40)

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

function fakeApi(behaviour) {
  const state = { revision: 0, landed: [], sessions: 0, versionCalls: 0 }
  const server = createServer((req, res) => {
    const chunks = []
    req.on("data", (chunk) => chunks.push(chunk))
    req.on("end", () => {
      const body = chunks.length === 0 ? undefined : JSON.parse(Buffer.concat(chunks).toString("utf8"))
      const send = (status, json, headers = {}) => {
        res.writeHead(status, { "content-type": "application/json", ...headers })
        res.end(json === undefined ? "" : JSON.stringify(json))
      }
      if (req.method === "GET" && req.url === "/version") {
        state.versionCalls += 1
        return send(200, { commit: behaviour.live(state.versionCalls) })
      }
      if (req.method === "GET" && req.url === "/health") return send(behaviour.health ?? 200, { ok: true })
      if (req.method === "POST" && req.url === "/smoke/session") {
        state.sessions += 1
        if (req.headers.authorization !== `Bearer ${token}` || behaviour.refuseSession) return send(404)
        return send(200, { ok: true }, { "set-cookie": `${cookieValue}; HttpOnly; Path=/` })
      }
      if (req.headers.cookie !== cookieValue) return send(401, { ok: false, refusal: "session" })
      if (req.method === "POST" && req.url === "/decks/open") {
        const register = { elements: { 1.1: { landed: state.landed } } }
        return send(200, { ok: true, deck: body.deck, revision: state.revision, register })
      }
      if (req.method === "POST" && req.url === "/decks/commit") {
        state.revision += behaviour.skipRevision ? 0 : 1
        if (!behaviour.dropWrite) {
          const value = behaviour.wrongValue ? "something else" : body.batch[0].value
          state.landed = [...state.landed, { actor: "person", value, visible: true }]
        }
        return send(200, { ok: true, deck: body.deck, revision: state.revision })
      }
      return send(404)
    })
  })
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ origin: `http://127.0.0.1:${server.address().port}`, state, close: () => server.close() })
    })
  })
}

async function run(behaviour, options = {}) {
  const api = await fakeApi(behaviour)
  try {
    const result = await smoke({
      origin: api.origin,
      commit,
      token,
      pollMs: 5,
      pollLimitMs: 60,
      contains: (a, b) => a === b,
      ...options,
    })
    return { result, state: api.state }
  } finally {
    api.close()
  }
}

const good = await run({ live: () => commit })
same("the good path passes", good.result.ok, true)
same("the good path leaves one committed value", good.state.landed.length, 1)
same("the good path raises the revision by one", good.state.revision, 1)

const later = await run({ live: (call) => (call < 3 ? "b".repeat(40) : commit) })
same("a commit that goes live late passes", later.result.ok, true)
same("a commit that goes live late was polled", later.state.versionCalls, 3)

const newer = await run(
  { live: () => "c".repeat(40) },
  { contains: (a, b) => a === "a".repeat(40) && b === "c".repeat(40) },
)
same("a newer commit that contains this one passes", newer.result.ok, true)

const never = await run({ live: () => "b".repeat(40) })
same("a commit that never goes live fails", never.result.ok, false)
same("a commit that never goes live names the step", never.result.line.startsWith("smoke failed at version:"), true)
same("a commit that never goes live writes nothing", never.state.sessions, 0)

const noHealth = await run({ live: () => commit, health: 503 })
same("a failing health check fails", noHealth.result.ok, false)
same("a failing health check names the step", noHealth.result.line, "smoke failed at health: status 503")
same("a failing health check asks for no session", noHealth.state.sessions, 0)

const wrongRead = await run({ live: () => commit, wrongValue: true })
same("a read of the wrong value fails", wrongRead.result.ok, false)
same("a read of the wrong value names the step", wrongRead.result.line.startsWith("smoke failed at read:"), true)

const lostWrite = await run({ live: () => commit, dropWrite: true })
same("a write that never lands fails", lostWrite.result.ok, false)

const flatRevision = await run({ live: () => commit, skipRevision: true })
same("a revision that did not rise fails", flatRevision.result.ok, false)
same(
  "a revision that did not rise names the step",
  flatRevision.result.line.startsWith("smoke failed at revision:"),
  true,
)

const refused = await run({ live: () => commit, refuseSession: true })
same("a refused session fails", refused.result.ok, false)
same("a refused session says what it got", refused.result.line, "smoke failed at session: status 404")
same("a refused session commits nothing", refused.state.revision, 0)

const wrongToken = await run({ live: () => commit }, { token: "not-the-token" })
same("a wrong token fails", wrongToken.result.ok, false)

const noToken = await run({ live: () => commit }, { token: undefined })
same("no token fails", noToken.result.line, "smoke failed at setup: SMOKE_TOKEN is not set")
same("no token asks for nothing", noToken.state.versionCalls, 0)

for (const outcome of [wrongRead, refused, wrongToken, flatRevision, never]) {
  if (outcome.result.line.includes(token) || outcome.result.line.includes("secret-cookie")) {
    throw new Error(`a failure line carries a secret: ${outcome.result.line}`)
  }
}

const quiet = await smoke({
  origin: "http://127.0.0.1:1",
  commit,
  token,
  pollMs: 5,
  pollLimitMs: 20,
  contains: () => true,
})
same("an unreachable API fails", quiet.ok, false)
same("an unreachable API names the step", quiet.line.startsWith("smoke failed at version:"), true)

const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
const parent = execFileSync("git", ["rev-parse", "HEAD~1"], { encoding: "utf8" }).trim()
same("a commit contains itself", containsCommit(head, head), true)
same("a commit contains its parent", containsCommit(parent, head), true)
same("a commit does not contain its child", containsCommit(head, parent), false)
same("unknown contains nothing", containsCommit(head, "unknown"), false)
same("an option-shaped commit is not passed to git", containsCommit("--all", head), false)
