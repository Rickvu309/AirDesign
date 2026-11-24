import { updateBody } from "./pr-body-update.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual, null, 1)}\n${JSON.stringify(expected, null, 1)}`)
  }
}

const repository = "Rickvu309/AirDesign"
const head = "a".repeat(40)
const oldHead = "ed84dea7"
const proof = `![Annotated](https://github.com/${repository}/releases/download/proof/pr-1-annotated-1-abcdef1234.png)`

const github = ({ files, offBranch = [], heads = [head] }) => {
  const patched = []
  const reads = []
  const api = (args) => {
    const call = args.join(" ")
    if (args.includes("PATCH")) {
      patched.push(args.find((arg) => arg.startsWith("body=")).slice("body=".length))
      return ""
    }
    if (call.includes("/files")) return files.map((name) => JSON.stringify({ name, status: "modified" })).join("\n")
    if (call.includes("/compare/")) {
      const sha = call.match(/compare\/([0-9a-f]+)\.\.\./)[1]
      return offBranch.includes(sha) ? "diverged" : "ahead"
    }
    reads.push(call)
    const now = heads[Math.min(reads.length - 1, heads.length - 1)]
    return JSON.stringify({
      head: now,
      base: "b".repeat(40),
      baseRef: "main",
      files: files.length,
      body: "old",
      title: "T",
    })
  }
  return { api, patched, reads }
}

const run = (body, options) => {
  const client = github(options)
  const result = updateBody({ api: client.api, repository, number: 1571, body })
  return { ...result, patched: client.patched }
}

const invisible = { files: ["scripts/land.mjs"] }
const visible = { files: ["apps/web/src/editor/canvas.tsx"] }
const cleanBody = "## Summary\n\nA.\n\n## Evidence\n\nRan it: 12 tests pass.\n"

const stale = run(`## Summary\n\nA.\n\n## Evidence\n\nMeasured at ${oldHead}: 12 tests pass.\n`, {
  ...invisible,
  offBranch: [oldHead],
})
same("a body naming an old head's hash is refused", stale.ok, false)
same("and the refusal is bar's own line", stale.lines.length, 1)
same(
  "and says which line and which commit",
  stale.lines[0].startsWith(`Body: line 7 names commit ${oldHead}, which is on neither this branch nor main`),
  true,
)
same("and PATCHes nothing", stale.patched, [])

const unseen = run(cleanBody, visible)
same("a visible change with no Before / after is refused", unseen.ok, false)
same(
  "and the refusal is bar's own line",
  unseen.lines[0].startsWith("Body: this changes what a person sees (apps/web/src/editor/canvas.tsx)"),
  true,
)
same("and PATCHes nothing", unseen.patched, [])

const shown = run(`${cleanBody}\n## Before / after\n\n${proof}\n`, visible)
same("a visible change with its proof image is accepted", shown.ok, true)
same("and PATCHes the body", shown.patched, [`${cleanBody}\n## Before / after\n\n${proof}\n`])

const clean = run(cleanBody, invisible)
same("a clean body is accepted", clean.ok, true)
same("and is PATCHed once, as written", clean.patched, [cleanBody])

const attributed = run(`${cleanBody}\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n`, invisible)
same("a body with an attribution line is refused", [attributed.ok, attributed.patched], [false, []])

const moved = "c".repeat(40)
const movedBefore = run(cleanBody, { ...invisible, heads: [head, moved] })
same("a head that moves after it was judged and before the write is refused", movedBefore.ok, false)
same("and PATCHes nothing", movedBefore.patched, [])
same(
  "and says both heads and to run it again",
  movedBefore.lines[0],
  "Body: pull request 1571 moved from head aaaaaaaa to cccccccc while the body was judged. Nothing was written. Run pnpm pr-body 1571 <file> again.",
)

const movedAfter = run(cleanBody, { ...invisible, heads: [head, head, moved] })
same("a head that moves during the write is reported", movedAfter.ok, false)
same("and the body was written once", movedAfter.patched, [cleanBody])
same(
  "and says to run it again",
  movedAfter.lines[0].endsWith(
    "so the body was not judged against the head it sits on. Run pnpm pr-body 1571 <file> again.",
  ),
  true,
)

same("a head that holds is accepted", run(cleanBody, { ...invisible, heads: [head] }).ok, true)
