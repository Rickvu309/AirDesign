import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { failureLines } from "./land-report.mjs"
import { decide } from "./red-main-verdict.mjs"

export const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual, null, 1)}\n${JSON.stringify(expected, null, 1)}`)
  }
}
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const fixture = (name) => fs.readFileSync(path.join(root, "scripts/red-main-fixtures", name), "utf8")
export const history = JSON.parse(fixture("history.json"))
export const repository = "Rickvu309/AirDesign"
export const culpritNumber = 499
export const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" })

export const logs = {
  43661138626: [{ name: "corpus", log: fixture("run-43661138626-corpus.log") }],
  43769394689: [{ name: "check (pptx)", log: fixture("run-43769394689-check-pptx.log") }],
  43769961904: [{ name: "check (main)", log: fixture("run-43769961904-check-main.log") }],
  43778249943: [{ name: "corpus", log: fixture("run-43778249943-corpus.log") }],
  44748130700: [{ name: "check (browser 8/8)", log: fixture("run-44748130700-check-browser-8.log") }],
  44764886281: [
    { name: "check (source 1/2)", log: fixture("run-44764886281-check-source-1.log") },
    { name: "check (browser 1/8)", log: fixture("run-44764886281-check-browser-1.log") },
  ],
}
const jobsOf = (run) => ({
  jobs: logs[run.id] ?? [],
  logs: (logs[run.id] ?? []).map((job) => job.log),
  warnings: [],
})
const filesBetween = (commits) => (from, to) => [
  ...new Set(
    commits.slice(commits.indexOf(from) + 1, commits.indexOf(to) + 1).flatMap((sha) => history.commits[sha].files),
  ),
]
export const upTo = (window, sha) => {
  const at = window.commits.findIndex((each) => each.startsWith(sha))
  return window.runs.filter((run) => window.commits.indexOf(run.sha) <= at)
}
export const decideIn = (window, sha, races = new Set(), runs = upTo(window, sha), rerun = undefined) =>
  decide({ runs, commits: window.commits, jobsOf, filesBetween: filesBetween(window.commits), races, rerun })
export const short = (sha) => sha?.slice(0, 7)
export const culpritBody = (section) =>
  `## Summary\n\nSets type.\n\n## Before / after\n\n${section}\n\n## Merge Danger\n\n**Door:** two-way.\n`

export const said = []
export const failureReads = []
export const recorder = (answers) => {
  const calls = []
  const answer = (who) => (args, input) => {
    calls.push({ who, args, input })
    for (const [pattern, reply] of answers) if (pattern.test(`${who} ${args.join(" ")}`)) return reply(args, input)
    return ok()
  }
  return { calls, gh: answer("gh"), owner: answer("owner"), git: answer("git") }
}
const asRuns = (runs) =>
  JSON.stringify(
    runs.map((run) => ({ databaseId: run.id, headSha: run.sha, status: run.status, conclusion: run.conclusion })),
  )
export const revertCi = (conclusion) => [
  /^gh run list .*--branch red-main\/revert-/,
  () => ok(JSON.stringify([{ databaseId: 9, headSha: "f".repeat(40), status: "completed", conclusion }])),
]
export const mainWith = (window, runs) => [
  [/^git rev-list --first-parent/, () => ok([...window.commits].reverse().join("\n"))],
  [/^gh run list/, () => ok(asRuns(runs))],
  [/^git diff --name-only/, (args) => ok(filesBetween(window.commits)(args.at(-2), args.at(-1)).join("\n"))],
  [/^gh issue list/, () => ok("[]")],
  [
    /^gh api repos\/Rickvu309\/AirDesign\/commits\/\w+\/pulls/,
    () => ok(JSON.stringify([{ number: 499, body: culpritBody("No visible change: only the exporter changes.") }])),
  ],
  [/^git log -1 --format=%s/, (args) => ok(history.commits[args.at(-1)].title)],
]
export const mainUpTo = (window, sha) => mainWith(window, upTo(window, sha))
export const io = (fake) => ({
  gh: fake.gh,
  owner: fake.owner,
  git: fake.git,
  jobsOf,
  redMain: (body) => {
    said.push(body)
    return ok()
  },
  rerun: fake.rerun,
  lowersTheBar: () => false,
  failure: (run, read) => {
    failureReads.push({ run, read })
    return failureLines({ repository, run, gh: () => ok(""), read }).lines
  },
})

export const pullOf = [
  /^gh pr list --repo \S+ --head/,
  () => ok(JSON.stringify([{ number: 1200, headRefOid: "f".repeat(40), isCrossRepository: false }])),
]
