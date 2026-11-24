import { runDrillCases } from "./red-main-drill.mjs"
import { history, io, logs, mainUpTo, mainWith, ok, recorder, repository, said, same } from "./red-main-replay.mjs"
import { redMainBot, revertBranch } from "./red-main-revert.mjs"

const november = history.windows.at(-1)
const [, conflictHead, greenHead, skillsHead] = november.commits
const controlLinkRace =
  "Race: tests/browser/control-link.spec.ts › a person saves and removes a whole text element URL @export"
const raceIssue = [/^gh issue create/, () => ok("https://github.com/Rickvu309/AirDesign/issues/1500\n")]
const issueTitles = (fake) =>
  fake.calls
    .filter(({ args }) => args[0] === "issue" && args[1] === "create")
    .map(({ args }) => args[args.indexOf("--title") + 1])
const afterConflict = recorder([...mainWith(november, november.runs), raceIssue])
await redMainBot({
  repository,
  event: { id: 44887813925, event: "push", branch: "main", sha: greenHead, conclusion: "success" },
  io: io(afterConflict),
})
same(
  "run 44887430866: the green push after the conflict records control-link even though run 44887944405 is already red",
  [
    issueTitles(afterConflict),
    afterConflict.calls.find(({ args }) => args[1] === "create")?.input.includes("/runs/44887430866"),
  ],
  [[controlLinkRace], true],
)

const revertHead = "80fbc1fe119bc1aa64e416db75790df1220c6fa5"
const designEvent = {
  id: 44888380660,
  event: "pull_request",
  branch: revertBranch(skillsHead),
  sha: revertHead,
  conclusion: "failure",
}
const revertPull1211 = [
  /^gh pr list --repo \S+ --head/,
  () => ok(JSON.stringify([{ number: 1211, headRefOid: revertHead, isCrossRepository: false }])),
]
const revertAnswers = [
  revertPull1211,
  ...mainUpTo(november, skillsHead),
  [/\/pulls\/1211\/files/, () => ok(history.commits[skillsHead].files.join("\n"))],
  raceIssue,
]
const designRace = "Race: design-states › slide-added-title"
const failedDesign = recorder(revertAnswers)
await redMainBot({ repository, event: designEvent, io: io(failedDesign) })
same(
  "run 44888380660: revert PR 1211 cannot reach slide-added-title, so the bot records the design race and closes and reopens it as the owner",
  [
    issueTitles(failedDesign),
    failedDesign.calls.filter(({ who }) => who === "owner").map(({ args }) => args.slice(0, 3).join(" ")),
  ],
  [[designRace], ["pr close 1211", "pr reopen 1211"]],
)
const failedFreshDesign = { ...designEvent, id: 44888380661 }
logs[failedFreshDesign.id] = logs[designEvent.id]
const secondDesign = recorder([
  [
    /\/issues\/1211\/comments/,
    () => ok(`This is the one fresh run for head ${revertHead}.\n<!-- fresh-ci-after: ${designEvent.id} -->`),
  ],
  ...revertAnswers,
])
await redMainBot({ repository, event: failedFreshDesign, io: io(secondDesign) })
same(
  "a failure in the fresh run leaves the revert open and reports the stop on main is red",
  [
    issueTitles(secondDesign),
    secondDesign.calls.some(({ who }) => who === "owner"),
    said.at(-1).includes("the one fresh run"),
  ],
  [[], false, true],
)
const revertChangedDesign = recorder([
  [/\/pulls\/1211\/files/, () => ok("apps/web/src/thin-deck.tsx\n")],
  ...revertAnswers,
])
await redMainBot({ repository, event: designEvent, io: io(revertChangedDesign) })
same(
  "a revert that can reach the failed design job stops immediately on main is red",
  [
    issueTitles(revertChangedDesign),
    revertChangedDesign.calls.some(({ who }) => who === "owner"),
    said.at(-1).includes("check (design 3/3)"),
  ],
  [[], false, true],
)

const drilled = await runDrillCases(redMainBot)
same(
  "every red-main drill case passes",
  drilled.map((each) => each.passed),
  drilled.map(() => true),
)
