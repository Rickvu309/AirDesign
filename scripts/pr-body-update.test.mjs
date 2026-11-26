import { updateBody } from "./pr-body-update.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual, null, 1)}\n${JSON.stringify(expected, null, 1)}`)
  }
}

const repository = "Rickvu309/AirDesign"
const head = "a".repeat(40)
const base = "b".repeat(40)
const oldHead = "ed84dea7"
const proof = `![Annotated](https://github.com/${repository}/releases/download/proof/pr-1-annotated-1-abcdef1234.png)`

const github = ({ files, offBranch = [], heads = [head], bases = [base], baseRefs = ["main"], patchError }) => {
  const patched = []
  const reads = []
  const comparisons = []
  const api = (args) => {
    const call = args.join(" ")
    if (args.includes("PATCH")) {
      patched.push(args.find((arg) => arg.startsWith("body=")).slice("body=".length))
      if (patchError && patched.length === 1) throw patchError
      return ""
    }
    if (call.includes("/files")) return files.map((name) => JSON.stringify({ name, status: "modified" })).join("\n")
    if (call.includes("/compare/")) {
      comparisons.push(call)
      const sha = call.match(/compare\/([0-9a-f]+)\.\.\./)[1]
      return offBranch.includes(sha) ? "diverged" : "ahead"
    }
    reads.push(call)
    const now = heads[Math.min(reads.length - 1, heads.length - 1)]
    return JSON.stringify({
      head: now,
      base: bases[Math.min(reads.length - 1, bases.length - 1)],
      baseRef: baseRefs[Math.min(reads.length - 1, baseRefs.length - 1)],
      files: files.length,
      body: "old",
      title: "T",
    })
  }
  return { api, patched, reads, comparisons }
}

const run = (body, options) => {
  const client = github(options)
  const result = updateBody({ api: client.api, repository, number: 1571, body })
  return { ...result, patched: client.patched, reads: client.reads, comparisons: client.comparisons }
}

const invisible = { files: ["scripts/land.mjs"] }
const visible = { files: ["apps/web/src/editor/canvas.tsx"] }
const cleanBody = "**Now:** A.\n**Proof:** Ran it: 12 tests pass.\n"

const stale = run(`**Now:** A.\n**Proof:** Ran it.\n\n\n\n\nMeasured at ${oldHead}: 12 tests pass.\n`, {
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

const treeBody = `${proof}\n\n<details><summary>Detail</summary>\n\n**Result.** A holds (Passed)\n\n</details>\n`
const shown = run(`${treeBody}\n## Before / after\n\n${proof}\n`, visible)
same("a visible change with its proof image is accepted", shown.ok, true)
same("and PATCHes the body", shown.patched, [`${treeBody}\n## Before / after\n\n${proof}\n`])
const plainShown = run(`${cleanBody}\n## Before / after\n\n${proof}\n`, visible)
same("a visible change that opens with the plain lines is refused", [plainShown.ok, plainShown.patched], [false, []])

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
    "Judge the body against the new pull request state. Run pnpm pr-body 1571 <file> again.",
  ),
  true,
)

same("a head that holds is accepted", run(cleanBody, { ...invisible, heads: [head] }).ok, true)

const patchError = new Error("GitHub answered with HTTP 502")

{
  const failed = run(cleanBody, { ...invisible, heads: [head, head, moved], patchError })
  same("a failed PATCH is attempted once", failed.patched, [cleanBody])
  same("a failed PATCH is followed by a metadata read", failed.reads.length, 3)
  same("a head move during a failed PATCH is reported", failed.ok, false)
  same("the failure names the new head", failed.lines[0].includes("cccccccc"), true)
}

{
  const failed = run(cleanBody, { ...invisible, patchError })
  same("a failed PATCH is attempted once even if the head holds", failed.patched, [cleanBody])
  same("metadata is read again even if the head holds", failed.reads.length, 3)
  same("the PATCH failure is reported", failed.ok, false)
  same("the failure names the GitHub error", failed.lines[0].includes("HTTP 502"), true)
}

{
  const retargeted = run(cleanBody, { ...invisible, baseRefs: ["maintenance", "main"] })
  same("a same-SHA base retarget is refused without a PATCH", [retargeted.ok, retargeted.patched], [false, []])
  same(
    "the refusal names both base refs",
    retargeted.lines[0].includes("maintenance") && retargeted.lines[0].includes("main"),
    true,
  )
}

{
  const body = cleanBody.replace("12 tests", `At ${oldHead}, 12 tests`)
  const checked = run(body, { ...invisible, baseRefs: ["maintenance"], offBranch: [oldHead] })
  same(
    "commit comparisons use the captured base SHA",
    checked.comparisons.some((call) => call.includes(`...${base}?`)),
    true,
  )
}

{
  const changed = run(cleanBody, { ...invisible, bases: [base, moved] })
  same("a base SHA move is refused without a PATCH", [changed.ok, changed.patched], [false, []])
  same(
    "a base-only move names the base change",
    changed.lines[0],
    "Body: pull request 1571 moved from base main@bbbbbbbb to main@cccccccc while the body was judged. Nothing was written. Run pnpm pr-body 1571 <file> again.",
  )
}
