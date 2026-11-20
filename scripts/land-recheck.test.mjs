import { harness, no, pullAnswer, same } from "./land-harness.mjs"

const passed = [{ __typename: "CheckRun", name: "ci", conclusion: "SUCCESS", status: "COMPLETED" }]
const clashLines = [
  "cd01ecb4 merged with origin/main 2a7448aa fails copy-in-tests, build in 64 s.",
  "  build: src/copy/shortcut-copy.ts(18,3): error TS2739",
  "it clashes with 2a7448aa Open a keyboard shortcuts panel with Ctrl+Shift+?, read from the gesture table",
]
const failing = async () => ({ ok: false, lines: clashLines })
const index = (log, prefix) => log.findIndex((line) => line.startsWith(prefix))

const queued = harness()
same("with the merge queue on, a clean recheck lets land queue as before", await queued.run(), 0)
same(
  "the recheck runs after ci starts and before the queue is entered",
  index(queued.log, "recheck") > index(queued.log, "git push") &&
    index(queued.log, "recheck") < index(queued.log, "gh pr merge"),
  true,
)
same(
  "and the queue is entered the way it always was",
  queued.log.find((line) => line.startsWith("gh pr merge")),
  "gh pr merge 394 --auto --rebase",
)

const queueClash = harness({ recheck: failing })
same("with the merge queue on, a failed recheck stops land", await queueClash.run(), 1)
same("before anything is queued", index(queueClash.log, "gh pr merge"), -1)
same(
  "and prints the failure and the main commit it clashes with",
  clashLines.every((each) => queueClash.said.some((line) => line.includes(each.trim()))),
  true,
)

const noQueue = [pullAnswer({ queue: false, contexts: passed })]
const direct = harness({
  reads: [...noQueue, ...noQueue, pullAnswer({ queue: false, merged: true })],
})
same("with no merge queue, land merges the head itself", await direct.run(), 0)
same(
  "only after ci passed, the recheck passed, and pinned to the head the recheck tested",
  [
    index(direct.log, "recheck") < index(direct.log, "gh pr merge"),
    direct.log.filter((line) => line.startsWith("gh pr merge")),
  ],
  [true, ["gh pr merge 394 --rebase --match-head-commit aaaa1111"]],
)
same(
  "the recheck was handed that head",
  direct.log.find((line) => line.startsWith("recheck")),
  "recheck 394 aaaa1111",
)
same(
  "auto-merge is never armed, so nothing merges without the recheck",
  direct.log.some((line) => line.includes("--auto")),
  false,
)

const directClash = harness({ reads: noQueue, recheck: failing })
same("with no merge queue, a failed recheck merges nothing", await directClash.run(), 1)
same("no merge is asked for", index(directClash.log, "gh pr merge"), -1)
same(
  "and the failure is printed",
  clashLines.every((each) => directClash.said.some((line) => line.includes(each.trim()))),
  true,
)

const watched = harness({
  args: ["--watch"],
  reads: [...noQueue, ...noQueue, pullAnswer({ queue: false, merged: true })],
})
same("pnpm land --watch with no merge queue rechecks and merges too", await watched.run(), 0)
same(
  "pinned to the head",
  watched.log.filter((line) => line.startsWith("gh pr merge")),
  ["gh pr merge 394 --rebase --match-head-commit aaaa1111"],
)

const rechecksOn = (...mains) => {
  let at = 0
  return async () => {
    const main = mains[Math.min(at++, mains.length - 1)]
    return { ok: true, main, lines: [`aaaa1111 merged with origin/main ${main} passes pnpm gate in 60 s.`] }
  }
}
const merged = pullAnswer({ queue: false, merged: true })
const green = pullAnswer({ queue: false, contexts: passed })
const mergeCalls = (log) => log.filter((line) => line.startsWith("gh pr merge"))
const rechecks = (log) => log.filter((line) => line.startsWith("recheck")).length

const overtaken = harness({
  reads: [green, green, merged],
  recheck: rechecksOn("m1", "m2"),
  mainHeads: ["m2", "m2"],
})
same("when another pull request merges during the recheck, land still merges", await overtaken.run(), 0)
same(
  "but only after a second recheck on the main that moved, never on the main it no longer matches",
  [rechecks(overtaken.log), mergeCalls(overtaken.log)],
  [2, ["gh pr merge 394 --rebase --match-head-commit aaaa1111"]],
)
same(
  "and it says main moved",
  overtaken.said.some((line) => line.includes("main moved to m2") && line.includes("1 of 3")),
  true,
)

const refused = harness({
  reads: [green, green, green, merged],
  recheck: rechecksOn("m1", "m2"),
  mainHeads: ["m1", "m2"],
  merges: [
    no("GraphQL: Base branch was modified. Review and try the merge again. (mergePullRequest)"),
    { status: 0, stdout: "", stderr: "" },
  ],
})
same("when GitHub refuses the merge because main moved under it, land merges on the retry", await refused.run(), 0)
same(
  "after fetching and rechecking again, with the head pinned both times",
  [rechecks(refused.log), mergeCalls(refused.log)],
  [
    2,
    ["gh pr merge 394 --rebase --match-head-commit aaaa1111", "gh pr merge 394 --rebase --match-head-commit aaaa1111"],
  ],
)

const pushed = harness({
  reads: [green, green, pullAnswer({ queue: false, contexts: passed, head: "bbbb2222" })],
  recheck: rechecksOn("m1"),
  mainHeads: ["m1"],
  merges: [no("GraphQL: Head branch was modified. Review and try the merge again. (mergePullRequest)")],
})
same("when the head moved, the merge is refused and land does not retry it", await pushed.run(), 1)
same("one recheck and one merge asked", [rechecks(pushed.log), mergeCalls(pushed.log).length], [1, 1])
same(
  "and it says the head moved, so the new head needs its own ci",
  pushed.said.some((line) => line.includes("head moved from aaaa1111 to bbbb2222")),
  true,
)

const busy = harness({
  reads: [green, green],
  recheck: rechecksOn("m1", "m2", "m3"),
  mainHeads: ["m9"],
})
same("when main keeps moving, land gives up after a bounded number of rechecks", await busy.run(), 1)
same("three rechecks and no merge", [rechecks(busy.log), mergeCalls(busy.log)], [3, []])
same(
  "and says how to try again",
  busy.said.some((line) => line.includes("not merged after 3 rechecks") && line.includes("pnpm land --watch")),
  true,
)
