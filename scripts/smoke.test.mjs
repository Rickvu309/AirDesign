import { createServer } from "node:http"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { deckIdFor, smoke } from "./smoke.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const token = "secret-token-for-the-fake"
const cookieValue = "airdesign.session=secret-cookie-for-the-fake"
const settled = "a".repeat(40)
const newer = "c".repeat(40)
const clock = 1_800_000_000_000

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

function fakeGit({ listed = settled, listStatus = 0, known = [], afterFetch = [], ancestor = 0 } = {}) {
  const calls = []
  const seen = [...known]
  const git = (args) => {
    calls.push(args)
    if (args[0] === "fetch") {
      seen.push(...afterFetch)
      return { status: 0, stdout: "" }
    }
    if (args[0] === "rev-list") return { status: listStatus, stdout: `${listed}\n` }
    if (args[0] === "cat-file") return { status: seen.includes(args[2].split("^")[0]) ? 0 : 128, stdout: "" }
    if (args[0] === "merge-base") return { status: ancestor, stdout: "" }
    return { status: 1, stdout: "" }
  }
  git.calls = calls
  return git
}

function fakeApi(behaviour) {
  const state = { revision: 0, landed: [], sessions: 0, versionCalls: 0, decks: [] }
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
        if (behaviour.versionStatus !== undefined) return send(behaviour.versionStatus)
        return send(200, { commit: behaviour.live })
      }
      if (req.method === "GET" && req.url === "/health") return send(behaviour.health ?? 200, { ok: true })
      if (req.method === "POST" && req.url === "/smoke/session") {
        state.sessions += 1
        if (req.headers.authorization !== `Bearer ${token}` || behaviour.refuseSession) return send(404)
        return send(200, { ok: true }, { "set-cookie": `${cookieValue}; HttpOnly; Path=/` })
      }
      if (req.headers.cookie !== cookieValue) return send(401, { ok: false, refusal: "session" })
      state.decks.push(body.deck)
      if (body.deck !== deckIdFor(token) || behaviour.refuseOpen) return send(200, { ok: false, refusal: "owner" })
      if (req.method === "POST" && req.url === "/decks/open") {
        if (behaviour.refuseRead && state.revision > 0) return send(200, { ok: false, refusal: "owner" })
        const register = { elements: { 1.1: { landed: state.landed } } }
        return send(200, { ok: true, deck: body.deck, revision: state.revision, register })
      }
      if (req.method === "POST" && req.url === "/decks/commit") {
        if (behaviour.refuseCommit || body.batch[0].node !== "1.1") return send(200, { ok: false, refusal: "limit" })
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
  const api = await fakeApi({ live: settled, ...behaviour })
  const git = options.git ?? fakeGit()
  try {
    const result = await smoke({ origin: api.origin, token, git, now: () => clock, ...options })
    return { result, state: api.state, git }
  } finally {
    api.close()
  }
}

const good = await run({})
same("the good path passes", good.result.ok, true)
same("the good path leaves one committed value", good.state.landed.length, 1)
same("the good path raises the revision by one", good.state.revision, 1)
same("the good path opens only the deck made from the token", [...new Set(good.state.decks)], [deckIdFor(token)])
same(
  "the good path asks git about no ancestor",
  good.git.calls.some((args) => args[0] === "merge-base"),
  false,
)

const graceSeconds = Math.floor((clock - 20 * 60_000) / 1000)
same(
  "the grace period is twenty minutes",
  good.git.calls.find((args) => args[0] === "rev-list"),
  ["rev-list", "-1", `--before=${String(graceSeconds)}`, "origin/main"],
)
same("main is fetched before anything is listed", good.git.calls[0], ["fetch", "origin", "main"])

const contained = await run({ live: newer }, { git: fakeGit({ known: [newer] }) })
same("a newer commit that contains the old one passes", contained.result.ok, true)
same(
  "the ancestor question is asked with the old commit first",
  contained.git.calls.find((args) => args[0] === "merge-base"),
  ["merge-base", "--is-ancestor", settled, newer],
)

const fetchedLater = await run({ live: newer }, { git: fakeGit({ afterFetch: [newer] }) })
same("a live commit that only the fetch brings in passes", fetchedLater.result.ok, true)

const notContained = await run({ live: newer }, { git: fakeGit({ known: [newer], ancestor: 1 }) })
same("a live commit that does not contain the old one fails", notContained.result.ok, false)
same(
  "a live commit that does not contain the old one says so",
  notContained.result.line,
  `smoke failed at version: live commit ${"c".repeat(12)} does not contain ${"a".repeat(12)}`,
)
same("a live commit that does not contain the old one writes nothing", notContained.state.sessions, 0)

const gitBroke = await run({ live: newer }, { git: fakeGit({ known: [newer], ancestor: 128 }) })
same("a git error is not read as containing", gitBroke.result.ok, false)

const unknownLive = await run({ live: newer }, { git: fakeGit() })
same("a live commit unknown after the fetch fails", unknownLive.result.ok, false)
same(
  "a live commit unknown after the fetch has its own line",
  unknownLive.result.line,
  `smoke failed at version: live commit ${"c".repeat(12)} is unknown to git after fetching main`,
)
same("a live commit unknown after the fetch writes nothing", unknownLive.state.sessions, 0)

const young = await run({ live: newer }, { git: fakeGit({ listed: "" }) })
same("no commit old enough skips the comparison", young.result.ok, true)
same(
  "no commit old enough asks git only to fetch and list",
  young.git.calls.map((args) => args[0]),
  ["fetch", "rev-list"],
)
same("no commit old enough still writes and reads", young.state.revision, 1)

const noMain = await run({}, { git: fakeGit({ listStatus: 128 }) })
same("an unreadable origin/main fails", noMain.result.line, "smoke failed at version: git could not read origin/main")

const unnamed = await run({ live: "unknown" })
same(
  "a live commit that is unknown fails",
  unnamed.result.line,
  "smoke failed at version: the API reports commit unknown",
)

const optionLike = await run({ live: "--all" })
same("a live commit shaped like an option fails", optionLike.result.ok, false)
same(
  "a live commit shaped like an option never reaches git",
  optionLike.git.calls.some((args) => args.some((arg) => arg.includes("--all"))),
  false,
)

const noVersion = await run({ versionStatus: 404 })
same("a missing version route fails", noVersion.result.line, "smoke failed at version: status 404")

const noHealth = await run({ health: 503 })
same("a failing health check names the step", noHealth.result.line, "smoke failed at health: status 503")
same("a failing health check asks for no session", noHealth.state.sessions, 0)

const wrongRead = await run({ wrongValue: true })
same("a read of the wrong value names the step", wrongRead.result.line.startsWith("smoke failed at read:"), true)

const lostWrite = await run({ dropWrite: true })
same("a write that never lands fails", lostWrite.result.ok, false)

const flatRevision = await run({ skipRevision: true })
same(
  "a revision that did not rise names the step",
  flatRevision.result.line.startsWith("smoke failed at revision:"),
  true,
)

const refusedSession = await run({ refuseSession: true })
same("a refused session says what it got", refusedSession.result.line, "smoke failed at session: status 404")
same("a refused session commits nothing", refusedSession.state.revision, 0)

const wrongToken = await run({}, { token: "not-the-token" })
same("a wrong token fails", wrongToken.result.ok, false)

const refusedOpen = await run({ refuseOpen: true })
same("a refused open names the refusal", refusedOpen.result.line, "smoke failed at open: status 200 owner")

const refusedCommit = await run({ refuseCommit: true })
same("a refused commit names the refusal", refusedCommit.result.line, "smoke failed at commit: status 200 limit")

const refusedRead = await run({ refuseRead: true })
same("a refused read names the refusal", refusedRead.result.line, "smoke failed at read: status 200 owner")

const noToken = await run({}, { token: undefined })
same("no token fails", noToken.result.line, "smoke failed at setup: SMOKE_TOKEN is not set")
same("no token touches neither git nor the API", [noToken.git.calls.length, noToken.state.versionCalls], [0, 0])

for (const outcome of [
  wrongRead,
  refusedSession,
  wrongToken,
  flatRevision,
  refusedOpen,
  refusedCommit,
  refusedRead,
  notContained,
]) {
  if (outcome.result.line.includes(token) || outcome.result.line.includes("secret-cookie")) {
    throw new Error(`a failure line carries a secret: ${outcome.result.line}`)
  }
}

const quiet = await smoke({ origin: "http://127.0.0.1:1", token, git: fakeGit(), now: () => clock })
same("an unreachable API names the step", quiet.line.startsWith("smoke failed at version:"), true)

same("the deck id fits the deck id pattern", /^[A-Za-z0-9_-]{1,64}$/.test(deckIdFor(token)), true)
same("the deck id is not the bare word smoke", deckIdFor(token) === "smoke", false)
same("the deck id does not carry the token", deckIdFor(token).includes(token), false)
same("the deck id follows the token", deckIdFor(token) === deckIdFor("another-token"), false)
same("the deck id is stable", deckIdFor(token), deckIdFor(token))

const workflow = fs.readFileSync(path.join(root, ".github/workflows/smoke.yml"), "utf8")
same("the workflow runs on a schedule", /^ {2}schedule:\n {4}- cron: "\*\/10 \* \* \* \*"$/m.test(workflow), true)
same("the workflow can be started by hand", /^ {2}workflow_dispatch:$/m.test(workflow), true)
same("the workflow does not run after another workflow", workflow.includes("workflow_run"), false)
same("the workflow does not run on a pull request", workflow.includes("pull_request"), false)
same("the smoke step cannot fail the job", /id: smoke\n {8}continue-on-error: true/.test(workflow), true)
same("the report step cannot fail the job", /if: always\(\)\n {8}continue-on-error: true/.test(workflow), true)
same(
  "the workflow may write issues and nothing else",
  /^permissions:\n {2}contents: read\n {2}issues: write$/m.test(workflow),
  true,
)
same("the alarm is the deploy-red issue", workflow.includes("--label deploy-red"), true)
same("the workflow does not swallow a failure with || true", workflow.includes("|| true"), false)
