import { bodyFaults } from "./pr-body.mjs"
import {
  decideIn,
  history,
  io,
  logs,
  mainUpTo,
  mainWith,
  ok,
  pullOf,
  recorder,
  repository,
  revertCi,
  said,
  same,
  short,
  upTo,
} from "./red-main-replay.mjs"
import { redMainBot, revertBranch } from "./red-main-revert.mjs"

const [, , flake, toolKeys] = history.windows
const gestureSizeAtLine =
  "Race: tests/browser/gesture-size.spec.ts:82 › a table resizes by its corner and by Width, scales its columns and rows, and exports at the size kept @export"
const toolKeysRace =
  "Race: tests/browser/tool-keys.spec.ts › T, R, O, L, Shift+L and Shift+Ctrl+K add a text box, shapes and an image from the slide, and not from a button"
const typecheck = { name: "check (source)", log: "fail typecheck 12.0s\nfailed: typecheck\n" }
const revertRun = (conclusion) => ({
  id: 9,
  event: "pull_request",
  branch: revertBranch(toolKeys.commits[1]),
  sha: "f".repeat(40),
  conclusion,
})

const suspect = decideIn(toolKeys, "9362c74")
same(
  "replay of run 44748130700: 9362c74 changes app code and spec-seconds.json but not tool-keys.spec.ts, so its timeout is a suspect, not a certain red",
  [
    suspect.action,
    short(suspect.target),
    suspect.run.id,
    suspect.judged.at(-1).verdict,
    suspect.judged.at(-1).tests.map((each) => [each.title, each.why]),
  ],
  [
    "suspect",
    "9362c74",
    44748130700,
    "suspect",
    [
      [
        toolKeysRace,
        "no commit it tests changes tests/browser/tool-keys.spec.ts, so it reaches the test only through app code",
      ],
    ],
  ],
)
const passedNext = decideIn(toolKeys, "3cab36d")
same(
  "the next push run passing at 3cab36d makes main green and names tool-keys as the race",
  [passedNext.action, passedNext.races.map((each) => [each.run.id, each.title])],
  ["green", [[44748130700, toolKeysRace]]],
)
const secondRed = { id: 44750000001, sha: toolKeys.commits[2], status: "completed", conclusion: "failure" }
logs[secondRed.id] = logs[44748130700]
const redTwice = [...upTo(toolKeys, "9362c74"), secondRed]
const confirmed = decideIn(toolKeys, "3cab36d", new Set(), redTwice)
same(
  "a second push run that fails tool-keys too confirms the suspect: the first red commit is reverted",
  [confirmed.action, short(confirmed.target), confirmed.run.id, confirmed.judged.at(-1).tests.map((each) => each.why)],
  ["revert", "9362c74", 44748130700, ["it failed in the red run before this one too"]],
)
const fixedSha = "e".repeat(40)
history.commits[fixedSha] = { title: "Fix the tool keys", files: ["apps/web/src/editor/tool-keys.ts"] }
const fixedWindow = { commits: [...toolKeys.commits, fixedSha] }
same(
  "a confirmed suspect names no race when main goes green",
  decideIn(fixedWindow, fixedSha, new Set(), [
    ...redTwice,
    { id: 44750000002, sha: fixedSha, status: "completed", conclusion: "success" },
  ]).races,
  [],
)
const typecheckRed = { id: 44750000003, sha: toolKeys.commits[1], status: "completed", conclusion: "failure" }
logs[typecheckRed.id] = [typecheck]
const typecheckRuns = [toolKeys.runs.at(-1), typecheckRed]
const certain = decideIn(toolKeys, "9362c74", new Set(), typecheckRuns)
same(
  "a typecheck red at 9362c74 is certain: the revert needs no second red",
  [certain.action, short(certain.target), certain.judged.at(-1).checks],
  ["revert", "9362c74", ["check (source): step typecheck"]],
)

const knownRace = recorder([
  [
    /^gh issue list/,
    () =>
      ok(
        JSON.stringify([
          { number: 1300, title: gestureSizeAtLine, url: "https://github.com/Rickvu309/AirDesign/issues/1300" },
        ]),
      ),
  ],
  ...mainUpTo(flake, "a56ac0a"),
])
await redMainBot({
  repository,
  event: { id: 43778249943, event: "push", branch: "main", sha: flake.commits[3], conclusion: "failure" },
  io: io(knownRace),
})
same(
  "a failure an open Race: issue names comments on that issue and opens no revert",
  [
    knownRace.calls
      .filter((call) => ["create", "comment"].includes(call.args[1]))
      .map((call) => call.args.slice(0, 3).join(" ")),
    knownRace.calls.some((call) => call.who === "owner"),
  ],
  [["issue comment 1300"], false],
)
same("the main is red issue links the race", said.at(-1).includes("issues/1300"), true)

const toolKeysRevert = revertBranch(toolKeys.commits[1])
const merges = (fake) =>
  fake.calls
    .filter((call) => call.args[0] === "pr" && ["merge", "close"].includes(call.args[1]))
    .map((call) => `${call.who} ${call.args[1]}`)

const suspectOpened = recorder([...mainUpTo(toolKeys, "9362c74"), [/^owner pr list/, () => ok("[]")]])
await redMainBot({
  repository,
  event: { id: 44748130700, event: "push", branch: "main", sha: toolKeys.commits[1], conclusion: "failure" },
  io: io(suspectOpened),
})
const suspectBody = suspectOpened.calls.find((call) => call.args[1] === "create")?.input ?? ""
same(
  "replay of run 44748130700: the bot opens the revert of 9362c74, says it waits for a second red, and records no race yet",
  [
    suspectOpened.calls.filter((call) => call.who === "owner").map((call) => call.args.slice(0, 2).join(" ")),
    suspectBody.includes("only once a later push run on main fails the same test"),
    bodyFaults(suspectBody, { changedFiles: history.commits[toolKeys.commits[1]].files, repository }),
    suspectOpened.calls.some((call) => call.args[0] === "issue" && call.args[1] === "create"),
    said.at(-1).includes("only once a later push run on main fails"),
  ],
  [["pr list", "pr create"], true, [], false, true],
)
const suspectPassed = recorder([...mainUpTo(toolKeys, "9362c74"), pullOf])
await redMainBot({ repository, event: revertRun("success"), io: io(suspectPassed) })
same(
  "the revert of a suspect that passes ci while main is red stays open: no merge before a second red",
  [merges(suspectPassed), suspectPassed.calls.some((call) => call.args.slice(0, 2).join(" ") === "pr comment")],
  [[], true],
)
const toolKeysGreen = recorder([
  ...mainUpTo(toolKeys, "3cab36d"),
  [
    /^gh pr list --repo \S+ --state open/,
    () => ok(JSON.stringify([{ number: 1073, headRefName: toolKeysRevert, isCrossRepository: false }])),
  ],
  [/^gh issue create/, () => ok("https://github.com/Rickvu309/AirDesign/issues/1301\n")],
])
await redMainBot({
  repository,
  event: { id: 44749476203, event: "push", branch: "main", sha: toolKeys.commits[2], conclusion: "success" },
  io: io(toolKeysGreen),
})
const toolKeysIssue = toolKeysGreen.calls.find((call) => call.args[0] === "issue" && call.args[1] === "create")
const toolKeysClose = toolKeysGreen.calls.find((call) => call.args[0] === "pr" && call.args[1] === "close")
same(
  "replay of 3cab36d passing next: the bot closes the revert, merges nothing, and files tool-keys as a race from run 44748130700",
  [
    merges(toolKeysGreen),
    toolKeysClose?.args[2],
    toolKeysIssue?.args[toolKeysIssue.args.indexOf("--title") + 1],
    toolKeysIssue?.input.includes(`https://github.com/${repository}/actions/runs/44748130700`),
    toolKeysIssue?.input.includes(toolKeys.commits[1]),
    toolKeysIssue?.input.includes('waiting for event "filechooser"'),
    toolKeysClose?.args.at(-1).includes("issues/1301"),
  ],
  [["gh close"], "1073", toolKeysRace, true, true, true, true],
)
const lateRevertCi = recorder([...mainUpTo(toolKeys, "3cab36d"), pullOf])
await redMainBot({ repository, event: revertRun("success"), io: io(lateRevertCi) })
same("a suspect's revert whose ci passes after main went green is closed", merges(lateRevertCi), ["gh close"])

const twiceMain = mainWith(toolKeys, redTwice)
const confirmedRevertCi = recorder([...twiceMain, pullOf])
await redMainBot({ repository, event: revertRun("success"), io: io(confirmedRevertCi) })
same(
  "replay of a red and then a red on the same test: the revert's passing ci merges it",
  confirmedRevertCi.calls.filter((call) => call.who === "owner").map((call) => call.args.join(" ")),
  [`pr merge 1200 --repo ${repository} --rebase --match-head-commit ${"f".repeat(40)}`],
)
const confirmedPush = recorder([
  revertCi("success"),
  ...twiceMain,
  [/^owner pr list/, () => ok(JSON.stringify([{ number: 1073, state: "OPEN", url: "u", headRefOid: "f".repeat(40) }]))],
])
await redMainBot({
  repository,
  event: { id: secondRed.id, event: "push", branch: "main", sha: secondRed.sha, conclusion: "failure" },
  io: io(confirmedPush),
})
same(
  "the second red on the same test merges the open revert whose ci already passed",
  confirmedPush.calls.filter((call) => call.args[1] === "merge").map((call) => `${call.who} ${call.args.join(" ")}`),
  [`owner pr merge 1073 --repo ${repository} --rebase --match-head-commit ${"f".repeat(40)}`],
)
const confirmedPending = recorder([
  revertCi("in_progress"),
  ...twiceMain,
  [/^owner pr list/, () => ok(JSON.stringify([{ number: 1073, state: "OPEN", url: "u", headRefOid: "f".repeat(40) }]))],
])
await redMainBot({
  repository,
  event: { id: secondRed.id, event: "push", branch: "main", sha: secondRed.sha, conclusion: "failure" },
  io: io(confirmedPending),
})
same("a confirmed revert whose ci still runs merges when that ci passes, not before", merges(confirmedPending), [])

const typecheckRevertCi = recorder([...mainWith(toolKeys, typecheckRuns), pullOf])
await redMainBot({ repository, event: revertRun("success"), io: io(typecheckRevertCi) })
same(
  "replay of a typecheck red: the revert merges on its own passing ci, with no second red",
  typecheckRevertCi.calls.filter((call) => call.who === "owner").map((call) => call.args.slice(0, 2).join(" ")),
  ["pr merge"],
)
