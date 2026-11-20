import { harness, pullAnswer, same } from "./land-harness.mjs"

const passed = [{ __typename: "CheckRun", name: "check (source)", conclusion: "SUCCESS", status: "COMPLETED" }]
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
