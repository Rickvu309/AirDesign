import { audit, failureClass, report } from "./ci-failure-report.mjs"
import { alarmAction, attemptId, countIn, falseStopBudget, falseStopLine } from "./ci-failure-report.mjs"
import { falseStops, lastMerged, mergedLimit } from "./ci-failure-report.mjs"
import { queueNumber, repeatRebaseLines, repeatRebases, stopLine } from "./ci-failure-report.mjs"

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

const run = (id, attempt, sha, conclusion) => ({ id, attempt, sha, conclusion })
const pull = (number, runs) => ({
  number,
  mergedAt: `2026-11-${String(number).padStart(2, "0")}T00:00:00Z`,
  runs,
})
const counted = (pulls) => falseStops(pulls).stops.map((stop) => stop.number)

same(
  "a failure then a pass on the same commit counts",
  counted([
    pull(1, [run(10, 1, "a", "failure"), run(10, 2, "a", "success")]),
    pull(2, [run(20, 1, "b", "failure"), run(21, 1, "b", "success")]),
  ]),
  [2, 1],
)
same(
  "a failure fixed by a new commit does not count",
  counted([pull(1, [run(10, 1, "a", "failure"), run(11, 1, "b", "success")])]),
  [],
)
same(
  "a failure with no later pass does not count",
  counted([pull(1, [run(10, 1, "a", "success"), run(10, 2, "a", "failure")])]),
  [],
)
same(
  "a cancelled run is not a stop",
  counted([pull(1, [run(10, 1, "a", "cancelled"), run(10, 2, "a", "success")])]),
  [],
)
same(
  "a timeout then a pass counts",
  counted([pull(1, [run(10, 1, "a", "timed_out"), run(10, 2, "a", "success")])]),
  [1],
)
same(
  "attempts are read in order whatever order they arrive in",
  counted([pull(1, [run(10, 2, "a", "success"), run(10, 1, "a", "failure")])]),
  [1],
)
const reruns = falseStops([
  pull(1, [run(10, 1, "a", "failure"), run(10, 2, "a", "failure"), run(10, 3, "a", "success")]),
])
same("a PR counts once however many reruns it had", reruns.count, 1)
same("each failed attempt is kept for its class", reruns.stops[0].runs.map(attemptId), [
  "10/attempts/1",
  "10/attempts/2",
])

const stopped = (number) => pull(number, [run(number, 1, "a", "failure"), run(number, 2, "a", "success")])
const many = Array.from({ length: mergedLimit + 1 }, (_, index) => stopped(index + 1))
const lastTwenty = falseStops(many)
same("only the last 20 merged PRs are read", [mergedLimit, lastTwenty.read, lastTwenty.count], [20, 20, 20])
same("the oldest merged PR falls out", counted(many).includes(1), false)
same(
  "last merged sorts by the merge, not the list order",
  lastMerged([pull(1, []), pull(3, []), pull(2, [])])[0].number,
  3,
)

same("the budget", falseStopBudget, 1)
const open = (count) => ({ number: "7", texts: ["other", falseStopLine({ count, read: 20 })] })
same("within budget with no issue", alarmAction(1, undefined), "none")
same("over budget with no issue", alarmAction(2, undefined), "open")
same("over budget and the number changed", alarmAction(3, open(2)), "comment")
same("over budget and the number held", alarmAction(2, open(2)), "none")
same("back within budget", alarmAction(1, open(2)), "close")
same(
  "the newest number wins",
  countIn([falseStopLine({ count: 4, read: 20 }), falseStopLine({ count: 2, read: 20 })]),
  2,
)
same("an issue with no number", countIn(["nothing here"]), undefined)
same("the line", falseStopLine({ count: 2, read: 20 }), "False stops: 2 of the last 20 merged PRs. Budget: 1.")

const queued = (number, runs, queueRuns) => ({ ...pull(number, runs), queueRuns })
const passedHead = (id, sha) => run(id, 1, sha, "success")

same(
  "a failed queue run then a merge on the same head counts",
  counted([queued(230, [passedHead(10, "a")], [run(11, 1, "q", "failure")])]),
  [230],
)
same(
  "a failed queue run then a requeue that passes on the same head counts",
  counted([queued(230, [passedHead(10, "a")], [run(11, 1, "q", "failure"), run(12, 1, "r", "success")])]),
  [230],
)
same(
  "a failed queue run followed by a new head commit does not count",
  counted([queued(1, [passedHead(10, "a"), passedHead(12, "b")], [run(11, 1, "q", "failure")])]),
  [],
)
same(
  "a new head commit before the failed queue run does not hide it",
  counted([queued(1, [passedHead(10, "a"), passedHead(11, "b")], [run(12, 1, "q", "failure")])]),
  [1],
)
same(
  "a later run on the same head is not a new head commit",
  counted([queued(1, [passedHead(10, "a"), passedHead(12, "a")], [run(11, 1, "q", "failure")])]),
  [1],
)
same(
  "head runs are read in order whatever order they arrive in",
  counted([queued(1, [passedHead(12, "b"), passedHead(10, "a")], [run(11, 1, "q", "failure")])]),
  [],
)
same(
  "a cancelled queue run is not a drop",
  counted([queued(1, [passedHead(10, "a")], [run(11, 1, "q", "cancelled")])]),
  [],
)
same("a passed queue run is not a drop", counted([queued(1, [passedHead(10, "a")], [run(11, 1, "q", "success")])]), [])
const twice = falseStops([
  queued(
    1,
    [run(10, 1, "a", "failure"), run(10, 2, "a", "success")],
    [run(11, 1, "q", "failure"), run(12, 1, "r", "failure")],
  ),
])
same("a PR counts once however it was stopped", twice.count, 1)
same("each failed run is kept for its class", twice.stops[0].runs.map(attemptId), [
  "10/attempts/1",
  "11/attempts/1",
  "12/attempts/1",
])
same(
  "a stop names both ways it was stopped",
  stopLine(twice.stops[0]),
  "- #1: 1 failed on a, then passed; 2 dropped from the queue by run 11, then merged on the same head",
)
same(
  "a stop on the head alone",
  stopLine(falseStops([pull(1, [run(10, 1, "abcdefghij", "failure"), run(10, 2, "abcdefghij", "success")])]).stops[0]),
  "- #1: 1 failed on abcdefg, then passed",
)
same(
  "a drop alone",
  stopLine(falseStops([queued(23, [passedHead(10, "a")], [run(42937916435, 1, "q", "failure")])]).stops[0]),
  "- #23: 1 dropped from the queue by run 42937916435, then merged on the same head",
)
same("the queue branch names its PR", queueNumber("gh-readonly-queue/main/pr-230-2d07863458846be7"), 230)
same("a branch that is not the queue", queueNumber("pr-230-fix"), NaN)
same("another base is not this queue", queueNumber("gh-readonly-queue/next/pr-230-2d07"), NaN)

const pushed = (number, events) => ({ ...pull(number, []), events })
const force = "head_ref_force_pushed"
same(
  "more than one force push is a repeat rebase",
  repeatRebases([pushed(1, [force, "committed", force]), pushed(2, [force]), pushed(3, ["committed"])]),
  { read: 3, count: 1, repeats: [{ number: 1, pushes: 2 }] },
)
same(
  "repeat rebases read only the last 20 merged PRs",
  repeatRebases(Array.from({ length: mergedLimit + 1 }, (_, index) => pushed(index + 1, [force, force]))).count,
  20,
)
same("the repeat rebase lines", repeatRebaseLines({ count: 1, read: 20, repeats: [{ number: 7, pushes: 3 }] }), [
  "Repeat rebases: 1 of the last 20 merged PRs.",
  "- #7: 3 force pushes",
])
same(
  "repeat rebases never read as a false stop count",
  countIn(repeatRebaseLines({ count: 9, read: 20, repeats: [] })),
  undefined,
)

console.log("ci-failure-report tests passed")
