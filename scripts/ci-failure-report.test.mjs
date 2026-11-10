import { audit, failureClass, report } from "./ci-failure-report.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}
const line = (step, text) => `ci\t${step}\t2026-11-10T03:12:40.1Z ${text}`

same("a failed check step", failureClass(line("Run pnpm check", "fail lint 3.5s")), "pnpm check: lint")
same("a failed typecheck", failureClass(line("Run pnpm check", "fail typecheck 0.4s")), "pnpm check: typecheck")
same(
  "a failed step from before steps were timed",
  failureClass(line("Run pnpm check", "fail typecheck")),
  "pnpm check: typecheck",
)
same(
  "the word fail inside other output",
  failureClass(line("Run pnpm check", "tests fail when run twice")),
  "other: Run pnpm check",
)
same(
  "a failed case",
  failureClass(line("Run pnpm check:pptx", "2 pptx checks failed")),
  "PowerPoint check: a case failed",
)
same(
  "a slow run",
  failureClass(line("Run pnpm check", "ci-duration is 41.2 and its limit is 40. Make it faster.")),
  "a timed metric went over its limit",
)
same(
  "a pull waiting for the owner",
  failureClass(line("Run node scripts/ratchet.mjs", "Only Rickvu309 can accept this. Ask for a review.")),
  "ratchet: waiting for the owner",
)
same(
  "an install that broke",
  failureClass(line("Run pnpm install --frozen-lockfile", "ERR_PNPM")),
  "other: Run pnpm install --frozen-lockfile",
)
same("no log", failureClass(""), "the run left no log")
same(
  "a step name cannot carry markup into the issue",
  failureClass(line("Run x | @someone `y`", "boom")),
  "other: Run x  someone y",
)

const runs = [
  { id: 1, conclusion: "success", branch: "a" },
  { id: 2, conclusion: "failure", branch: "a" },
  { id: 3, conclusion: "failure", branch: "main" },
  { id: 4, conclusion: "failure", branch: "b" },
  { id: 5, conclusion: "cancelled", branch: "b" },
]
const logs = new Map([
  [2, line("Run pnpm check", "fail lint 3.5s")],
  [3, line("Run pnpm check", "fail typecheck 0.4s")],
  [4, line("Run pnpm check", "fail lint 1.1s")],
])
const result = audit({ runs, logs })
same("counts", [result.total, result.failed, result.redMain], [5, 3, 1])
same("the most common class comes first", result.ranked, [
  ["pnpm check: lint", [2, 4]],
  ["pnpm check: typecheck", [3]],
])
const lines = report(result, "owner/repo")
if (!lines.includes("| 2 | pnpm check: lint | https://github.com/owner/repo/actions/runs/2 |"))
  throw new Error(lines.join("\n"))

console.log("ci-failure-report tests passed")
