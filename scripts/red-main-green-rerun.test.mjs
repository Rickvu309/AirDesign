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
