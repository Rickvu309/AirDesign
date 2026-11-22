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
  said,
  same,
  short,
  upTo,
} from "./red-main-replay.mjs"
import { redMainBot, revertBranch } from "./red-main-revert.mjs"

const [, , , toolKeys, connector] = history.windows
const [green, red] = connector.commits
const connectorTest = "packages/document/src/connector.property.test.ts"
const connectorName = "puts every bound end on its site, whatever the shapes' places, turns, flips and presets"
const noticeRace =
  "Race: tests/browser/notice-motion.spec.ts › the notice after an undo that changed nothing shows at once"
const seed = { seed: -1896601759, path: "90:0:0:0:0:0:2:2:2:2:3:4:4:4:2:2:1:2:1:1:3:3:1:1:1" }

const rerunAs = (results) => {
  const calls = []
  const rerun = ({ at, test }) => {
    calls.push({ at, file: test.file, replay: test.replay })
    const result = results[test.file] ?? "passes"
    return result === "unrun" ? { result, at, why: "pnpm install failed" } : { result, at }
  }
  return { calls, rerun }
}

const oldFault = rerunAs({ [connectorTest]: "fails" })
const replayed = decideIn(connector, "ee5ab77", new Set(), upTo(connector, "ee5ab77"), oldFault.rerun)
same(
  "replay of run 44764886281: the connector property fails at the last green commit f5d7651 with the same seed and path, so it is an old fault and ee5ab77 is not reverted for it",
  [
    replayed.action,
    replayed.judged.at(-1).tests.map((each) => [each.test.file, each.verdict]),
    replayed.judged.at(-1).tests[0].why,
    oldFault.calls,
  ],
  [
    "suspect",
    [
      [connectorTest, "old"],
      ["tests/browser/notice-motion.spec.ts", "suspect"],
    ],
    "it fails the same way at the last green commit f5d765110 too, with the same seed and path, so no commit after it caused this",
    [{ at: green, file: connectorTest, replay: seed }],
  ],
)
same(
  "without the green rerun the same run is a certain red, the wrong revert of pull request 1101",
  [decideIn(connector, "ee5ab77").action, short(decideIn(connector, "ee5ab77").target)],
  ["revert", "ee5ab77"],
)

const caused = rerunAs({ [connectorTest]: "passes" })
const passes = decideIn(connector, "ee5ab77", new Set(), upTo(connector, "ee5ab77"), caused.rerun)
same(
  "a unit failure that passes at the last green commit is the commit's: the bot reverts ee5ab77",
  [passes.action, short(passes.target), passes.judged.at(-1).tests[0].why],
  [
    "revert",
    "ee5ab77",
    `${connectorTest} is a unit or script test, and no open Race: issue names it, and it passes at the last green commit f5d765110, with the same seed and path`,
  ],
)

const unrun = decideIn(
  connector,
  "ee5ab77",
  new Set(),
  upTo(connector, "ee5ab77"),
  rerunAs({ [connectorTest]: "unrun" }).rerun,
)
same(
  "a green rerun that cannot run reverts nothing and says why",
  [unrun.action, unrun.judged.at(-1).verdict, unrun.judged.at(-1).why],
  [
    "hold",
    "unknown",
    `Race: ${connectorTest} › ${connectorName}: the bot could not tell whether it fails at the last green commit too: pnpm install failed`,
  ],
)

const typecheckRed = { id: 44764886282, sha: red, status: "completed", conclusion: "failure" }
logs[typecheckRed.id] = [
  { name: "check (source 2/2)", log: "fail typecheck 12.0s\nfailed: typecheck\n" },
  ...logs[44764886281],
]
const typecheckRerun = rerunAs({ [connectorTest]: "fails" })
const typecheck = decideIn(connector, "ee5ab77", new Set(), [connector.runs[1], typecheckRed], typecheckRerun.rerun)
same(
  "replay of a typecheck red with the same unit failure: certain at once, with no green rerun to wait for",
  [typecheck.action, short(typecheck.target), typecheck.judged.at(-1).checks, typecheckRerun.calls],
  ["revert", "ee5ab77", ["check (source 2/2): step typecheck"], []],
)

const secondRed = { id: 44750000001, sha: toolKeys.commits[2], status: "completed", conclusion: "failure" }
logs[secondRed.id] = logs[44748130700]
const redTwice = [...upTo(toolKeys, "9362c74"), secondRed]
const toolKeysSpec = "tests/browser/tool-keys.spec.ts"
const confirmedOld = rerunAs({ [toolKeysSpec]: "fails" })
const browserOld = decideIn(toolKeys, "3cab36d", new Set(), redTwice, confirmedOld.rerun)
same(
  "a browser test red twice that also fails at the last green commit leaves its revert waiting, never merged",
  [browserOld.action, browserOld.judged.at(-1).tests.map((each) => each.verdict), confirmedOld.calls.length],
  ["suspect", ["old"], 1],
)
const confirmedNew = rerunAs({ [toolKeysSpec]: "passes" })
same(
  "a browser test red twice that passes at the last green commit confirms the suspect",
  [decideIn(toolKeys, "3cab36d", new Set(), redTwice, confirmedNew.rerun).action, confirmedNew.calls.length],
  ["revert", 1],
)
const suspectOnce = rerunAs({})
decideIn(toolKeys, "9362c74", new Set(), upTo(toolKeys, "9362c74"), suspectOnce.rerun)
same("a browser test red once is not rerun: the suspect waits for a second red", suspectOnce.calls, [])

const oldFaultIssue = "https://github.com/Rickvu309/AirDesign/issues/1400"
const replayBot = (rerun, answers = []) => {
  const fake = recorder([
    ...answers,
    ...mainUpTo(connector, "ee5ab77"),
    [/^owner pr list/, () => ok("[]")],
    [/^gh issue create/, () => ok(`${oldFaultIssue}\n`)],
  ])
  return {
    fake,
    run: redMainBot({
      repository,
      event: { id: 44764886281, event: "push", branch: "main", sha: red, conclusion: "failure" },
      io: io({ ...fake, rerun }),
    }),
  }
}
const live = replayBot(rerunAs({ [connectorTest]: "fails" }).rerun)
await live.run
const filed = live.fake.calls.find((call) => call.args[0] === "issue" && call.args[1] === "create")
same(
  "the bot files the old fault with its seed, merges nothing, and opens only the suspect revert of notice-motion that waits for a second red",
  [
    filed?.args[filed.args.indexOf("--title") + 1],
    filed?.input.includes(`{"seed":${seed.seed},"path":"${seed.path}"}`),
    filed?.input.includes(green),
    filed?.input.includes(`https://github.com/${repository}/actions/runs/44764886281`),
    live.fake.calls.filter((call) => call.who === "owner").map((call) => call.args.slice(0, 2).join(" ")),
    said.some((body) => body.includes(oldFaultIssue)),
  ],
  [`Old fault: ${connectorTest} › ${connectorName}`, true, true, true, ["pr list", "pr create"], true],
)

const knownRace = replayBot(rerunAs({ [connectorTest]: "fails" }).rerun, [
  [
    /^gh issue list/,
    () =>
      ok(
        JSON.stringify([
          { number: 1130, title: noticeRace, url: "https://github.com/Rickvu309/AirDesign/issues/1130" },
        ]),
      ),
  ],
])
await knownRace.run
same(
  "with notice-motion's race already open, run 44764886281 opens no revert at all: it comments on the race and files the old fault",
  [
    knownRace.fake.calls.some((call) => call.who === "owner"),
    knownRace.fake.calls
      .filter((call) => call.args[0] === "issue" && call.args[1] !== "list")
      .map((call) => call.args.slice(0, 3).join(" ")),
  ],
  [false, ["issue create --repo", "issue comment 1130"]],
)

const revertCiPassed = recorder([...mainWith(connector, upTo(connector, "ee5ab77")), pullOf])
await redMainBot({
  repository,
  event: { id: 9, event: "pull_request", branch: revertBranch(red), sha: "f".repeat(40), conclusion: "success" },
  io: io({ ...revertCiPassed, rerun: rerunAs({ [connectorTest]: "fails" }).rerun }),
})
same(
  "a revert opened for the suspect is never merged on the old fault",
  revertCiPassed.calls.some((call) => call.args[1] === "merge"),
  false,
)

const nextGreen = "d".repeat(40)
history.commits[nextGreen] = {
  title: "Keep an elbow whose ends meet a point on its site",
  files: ["packages/document/src/connector.ts"],
}
const greenAfter = { id: 44767298331, sha: nextGreen, status: "completed", conclusion: "success" }
const ended = (rerun) =>
  decideIn({ commits: [...connector.commits, nextGreen] }, nextGreen, new Set(), [...connector.runs, greenAfter], rerun)
same(
  "the next green push names notice-motion as the race of run 44764886281, once the connector property is known to be an old fault",
  [ended(rerunAs({ [connectorTest]: "fails" }).rerun).races.map((each) => [each.run.id, each.title])],
  [[[44764886281, noticeRace]]],
)

const greenBeforeLeftOut = "0d318ba4b305e9f74291cbbd98c0811ccc347735"
const ec82581 = "ec82581b004ee250af756c938d00ce55822a3500"
const afterLeftOut = "475bfffe19687933e81c90c9dd2b6d214281f955"
const leftOutTest = "apps/web/src/left-out-replay.test.ts"
const leftOutName =
  "replays every state of the left-out spec through the tab's writer: each writable edit written, the rest left out and named"
history.commits[greenBeforeLeftOut] = { title: "Use the deck's named type scale only when the deck has one", files: [] }
history.commits[ec82581] = {
  title: "Open a deck with an edit the tab cannot write, leave that edit out and say so",
  files: [leftOutTest],
}
history.commits[afterLeftOut] = { title: "Let an agent create a blank deck it can read and edit at once", files: [] }
const leftOutRun = { id: 44959805557, sha: ec82581, status: "completed", conclusion: "failure" }
const leftOutGreenRun = { id: 44959700000, sha: greenBeforeLeftOut, status: "completed", conclusion: "success" }
const leftOutAfterRun = { id: 44960059334, sha: afterLeftOut, status: "completed", conclusion: "success" }
logs[leftOutRun.id] = [
  {
    name: "check (source 2/2)",
    log: [
      ` FAIL   unit  ${leftOutTest} > ${leftOutName}`,
      "Error: Test timed out in 5000ms.",
      "failed: unit-tests",
    ].join("\n"),
  },
]
const leftOutWindow = {
  commits: [greenBeforeLeftOut, ec82581, afterLeftOut],
  runs: [leftOutGreenRun, leftOutRun, leftOutAfterRun],
}
const unusedRerun = rerunAs({ [leftOutTest]: "unclear" })
const addedLeftOut = decideIn(
  leftOutWindow,
  "ec82581",
  new Set(),
  [leftOutGreenRun, leftOutRun],
  unusedRerun.rerun,
  (from, to, file) => (from === greenBeforeLeftOut && to === ec82581 && file === leftOutTest ? ec82581 : undefined),
)
same(
  "a failing test file absent at the last green commit is treated as the adding commit's own, skips rerun, and names the commit in plain words",
  [
    addedLeftOut.action,
    short(addedLeftOut.target),
    addedLeftOut.judged.at(-1).verdict,
    unusedRerun.calls.length,
    addedLeftOut.judged.at(-1).tests[0].why.includes("does not exist at the last green commit"),
    addedLeftOut.judged.at(-1).tests[0].why.includes(ec82581.slice(0, 9)),
  ],
  ["revert", "ec82581", "real", 0, true, true],
)

const addedBot = recorder([
  [
    /^git cat-file -e 0d318ba4b305e9f74291cbbd98c0811ccc347735:apps\/web\/src\/left-out-replay\.test\.ts/,
    () => ({ status: 128, stdout: "", stderr: "" }),
  ],
  [/^git log --no-renames --diff-filter=A/, () => ok(`${ec82581}\n`)],
  ...mainWith(leftOutWindow, [leftOutGreenRun, leftOutRun]),
  [/^owner pr list/, () => ok("[]")],
])
await redMainBot({
  repository,
  event: { id: leftOutRun.id, event: "push", branch: "main", sha: ec82581, conclusion: "failure" },
  io: io({ ...addedBot, rerun: rerunAs({ [leftOutTest]: "unclear" }).rerun }),
})
const addedRevertBody = addedBot.calls.find((call) => call.who === "owner" && call.args[1] === "create")?.input ?? ""
same(
  "redMainBot reverts ec82581 for its newly added failing test and explains in plain words why it is not a race",
  [addedRevertBody.includes("does not exist at the last green commit"), addedRevertBody.includes(ec82581.slice(0, 9))],
  [true, true],
)

const unclearRerun = ({ at }) => ({
  result: "unclear",
  at,
  why: "it ended with status 1 and named no failure of this test",
})
const unclearThenGreen = recorder([
  ...mainWith(leftOutWindow, [leftOutGreenRun, leftOutRun, leftOutAfterRun]),
  [/^gh issue create/, () => ok("https://github.com/Rickvu309/AirDesign/issues/1600\n")],
])
await redMainBot({
  repository,
  event: { id: leftOutAfterRun.id, event: "push", branch: "main", sha: afterLeftOut, conclusion: "success" },
  io: io({ ...unclearThenGreen, rerun: unclearRerun }),
})
const unclearIssue = unclearThenGreen.calls.find((call) => call.args[0] === "issue" && call.args[1] === "create")
same(
  "when an unclear green rerun leaves main un-reverted and the next push passes, the bot files a Race: issue for that test",
  [
    unclearIssue?.args[unclearIssue.args.indexOf("--title") + 1],
    unclearIssue?.input.includes(`https://github.com/${repository}/actions/runs/${leftOutRun.id}`),
    unclearIssue?.input.includes(`https://github.com/${repository}/actions/runs/${leftOutAfterRun.id}`),
  ],
  [`Race: ${leftOutTest} › ${leftOutName}`, true, true],
)

const mixedUnknownAndRace = recorder([
  [
    /^gh issue list/,
    () =>
      ok(
        JSON.stringify([
          { number: 1130, title: noticeRace, url: "https://github.com/Rickvu309/AirDesign/issues/1130" },
        ]),
      ),
  ],
  ...mainUpTo(connector, "ee5ab77"),
])
await redMainBot({
  repository,
  event: { id: 44764886281, event: "push", branch: "main", sha: red, conclusion: "failure" },
  io: io({ ...mixedUnknownAndRace, rerun: rerunAs({ [connectorTest]: "unrun" }).rerun }),
})
same(
  "a run with an unrun test and a known race still comments on the race issue and reverts nothing",
  [
    mixedUnknownAndRace.calls.some((call) => call.who === "owner"),
    mixedUnknownAndRace.calls
      .filter((call) => call.args[0] === "issue" && call.args[1] === "comment")
      .map((call) => call.args[2]),
  ],
  [false, ["1130"]],
)
