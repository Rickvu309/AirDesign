import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { failedTests } from "./failed-tests.mjs"
import { drillGreenRerun } from "./green-rerun-drill.mjs"
import { greenRerun, rerunCommand, rerunResult } from "./green-rerun.mjs"
import { replayVariable } from "./property-seed.mjs"
import { logs, root, same } from "./red-main-replay.mjs"

const replay = { seed: -1896601759, path: "90:0:0:0:0:0:2:2:2:2:3:4:4:4:2:2:1:2:1:1:3:3:1:1:1" }
const [connector] = failedTests(logs[44764886281][0].log)
const property = { ...connector, replay }
const [notice] = failedTests(logs[44764886281][1].log)
const green = "f5d76511041572d19949cf08bcda3572898ece39"

same("a unit test reruns alone in Vitest with the printed seed and path", rerunCommand(property), {
  browser: false,
  command: "node",
  args: [
    "node_modules/vitest/vitest.mjs",
    "run",
    "packages/document/src/connector.property.test.ts",
    "-t",
    "puts every bound end on its site, whatever the shapes' places, turns, flips and presets",
  ],
  env: { [replayVariable]: JSON.stringify(replay) },
})
same("a browser test reruns alone through the browser build, one worker", rerunCommand(notice).args, [
  "test:browser",
  "tests/browser/notice-motion.spec.ts",
  "--grep",
  "the notice after an undo that changed nothing shows at once",
  "--workers=1",
])
same(
  "a journey reruns through the journeys config",
  rerunCommand({ file: "tests/journeys/journeys.spec.ts", name: "open (a) deck", error: "" }).args.slice(0, 4),
  ["test:journeys", "tests/journeys/journeys.spec.ts", "--grep", "open \\(a\\) deck"],
)
same(
  "a script test reruns through the tooling runner",
  rerunCommand({ file: "scripts/land.test.mjs", name: "(the whole file)", error: "" }).args,
  ["scripts/tooling-tests.mjs", "scripts/land.test.mjs"],
)
same(
  "a Vitest file that failed whole reruns whole",
  rerunCommand({ file: "packages/live/src/sync.test.ts", name: "(the whole file)", error: "" }).args,
  ["node_modules/vitest/vitest.mjs", "run", "packages/live/src/sync.test.ts"],
)

const failedAgain = [
  " FAIL  |unit| packages/document/src/connector.property.test.ts > puts every bound end on its site, whatever the shapes' places, turns, flips and presets",
  "Error: Property failed after 1 tests",
  `{ seed: ${replay.seed}, path: "${replay.path}", endOnFailure: true }`,
].join("\n")
same(
  "the same test failing with the same error is a failure at green, whatever the counts in it",
  rerunResult({ test: property, status: 1, output: failedAgain }),
  { result: "fails", error: "Error: Property failed after 1 tests" },
)
same("a rerun that passes says so", rerunResult({ test: property, status: 0, output: " Tests  1 passed (1)" }), {
  result: "passes",
})
same(
  "a different error at green cannot tell",
  rerunResult({
    test: property,
    status: 1,
    output: failedAgain.replace("Property failed after 1 tests", "PostgreSQL 18 was not found."),
  }).result,
  "unclear",
)
same(
  "a rerun that fails without naming the test cannot tell",
  rerunResult({ test: property, status: 1, output: "Error: Cannot find module 'vitest'" }).result,
  "unclear",
)

const home = fs.mkdtempSync(path.join(os.tmpdir(), "green-rerun-test-"))
const calls = []
const fakeRun = (answers) => (command, args, options) => {
  calls.push([command, ...args.slice(0, 2), options.env?.[replayVariable] === undefined ? "" : "seeded"])
  if (args[1] === "add") fs.mkdirSync(path.join(args.at(-2), "scripts"), { recursive: true })
  return answers(command, args) ?? { status: 0, output: "" }
}
const rerun = greenRerun({
  root,
  home,
  run: fakeRun((command, args) =>
    args[0] === "node_modules/vitest/vitest.mjs" ? { status: 1, output: failedAgain } : undefined,
  ),
})
const first = rerun({ at: green, test: property })
const again = rerun({ at: green, test: property })
same(
  "the rerun makes one worktree at the green commit, installs once, and reruns the test with its seed once",
  [first.result, first.at, again === first, calls],
  [
    "fails",
    green,
    true,
    [
      ["git", "worktree", "remove", ""],
      ["git", "worktree", "add", ""],
      ["pnpm", "install", "--frozen-lockfile", ""],
      ["node", "node_modules/vitest/vitest.mjs", "run", "seeded"],
    ],
  ],
)
same(
  "the worktree gets this checkout's fast-check harness, so an older green commit takes the seed too",
  fs.readFileSync(path.join(home, `green-rerun-${green}`, "scripts/property-seed.mjs"), "utf8"),
  fs.readFileSync(path.join(root, "scripts/property-seed.mjs"), "utf8"),
)
calls.length = 0
rerun({ at: green, test: notice })
same(
  "a browser test adds the browser tools to the same worktree before it reruns",
  calls.map((call) => call.slice(0, 3)),
  [
    ["pnpm", "exec", "playwright"],
    ["pnpm", "test:browser", "tests/browser/notice-motion.spec.ts"],
  ],
)

const broken = greenRerun({
  root,
  home,
  run: fakeRun((command, args) => (args[0] === "install" ? { status: 1, output: "ERR_PNPM_FETCH_404\n" } : undefined)),
})
same("a failed install leaves the test unrun, with the reason", broken({ at: "a".repeat(40), test: property }), {
  result: "unrun",
  at: "a".repeat(40),
  why: `pnpm install --frozen-lockfile failed at ${"a".repeat(40)}: ERR_PNPM_FETCH_404`,
})
fs.rmSync(home, { recursive: true, force: true })

const drillCalls = []
const drilled = drillGreenRerun({
  repository: "Rickvu309/AirDesign",
  id: 44764886281,
  gh: (args) => {
    if (args[0] === "run")
      return { status: 0, stdout: JSON.stringify({ headSha: "ee5ab7748b4f858c90cbd015c213e3aa78e8e15b" }), stderr: "" }
    if (args[1].endsWith("/jobs?per_page=100"))
      return {
        status: 0,
        stdout: JSON.stringify([
          { id: 1, name: "check (source 1/2)" },
          { id: 2, name: "check (browser 1/8)" },
        ]),
        stderr: "",
      }
    return { status: 0, stdout: logs[44764886281][args[1].includes("/jobs/1/") ? 0 : 1].log, stderr: "" }
  },
  git: (args) => ({
    status: 0,
    stdout: args[1] === "ee5ab7748b4f858c90cbd015c213e3aa78e8e15b^" ? `${green}\n` : "",
    stderr: "",
  }),
  rerun: ({ at, test }) => {
    drillCalls.push([at, test.file, test.replay?.seed])
    return { result: test.replay === undefined ? "passes" : "fails", at }
  },
  say: () => {},
})
same(
  "the drill reruns every failed test of a red run at its parent, the property with its seed",
  [drilled.failed, drillCalls],
  [
    false,
    [
      [green, "packages/document/src/connector.property.test.ts", replay.seed],
      [green, "tests/browser/notice-motion.spec.ts", undefined],
    ],
  ],
)
