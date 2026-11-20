import fs from "node:fs"
import { checkSteps, specCache } from "./check-steps.mjs"
import { failedTests } from "./failed-tests.mjs"
import { judgeCheck } from "./land-check.mjs"
import { failureExcerpt, forceTheGap, raceTitle, recordRace } from "./race-issue.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual, null, 1)}\n${JSON.stringify(expected, null, 1)}`)
  }
}
const fixture = (name) => fs.readFileSync(new URL(`./land-fixtures/${name}`, import.meta.url), "utf8")
const vitestOutput = fixture("vitest-failed.log")
const saveStatusLog = fixture("job-playwright-failed.log")
const file = "apps/api/src/agent-commit-race.test.ts"
const testName =
  "an agent edit that meets a person's edit on another element while it is stored > lands once when the deck's index arrives between the read and the write, and counts one tool call"
const issueUrl = "https://github.com/Rickvu309/AirDesign/issues/990"

const judged = async ({
  status,
  output,
  alone = { status: 0, output: "" },
  changed = [],
  recorded = { url: issueUrl },
}) => {
  const said = []
  const asked = []
  const records = []
  const verdict = await judgeCheck({
    status,
    output,
    changed,
    rerun: async (test) => {
      asked.push(test)
      return typeof alone === "function" ? alone(test) : alone
    },
    record: async (race) => {
      records.push(race)
      return recorded
    },
    say: (line) => said.push(line),
  })
  return { verdict, said, asked, records }
}
const neverLoad = (what, { verdict, said }) => {
  const words = [verdict.how, ...said].filter((line) => /\bload\b/i.test(line))
  if (words.length > 0) throw new Error(`${what} says load: ${words.join(" | ")}`)
}

const passing = await judged({ status: 0, output: "ok lint 1s\n" })
same("a gate that passed is passed", passing.verdict, { passed: true, how: "the gate passed" })
same("a passing check reruns nothing", passing.asked, [])

const outside = await judged({
  status: 1,
  output: vitestOutput,
  alone: { status: 0, output: "1 passed" },
  changed: ["apps/web/src/editor/save.ts"],
})
same("a test outside the diff that passes alone lets the push go on", outside.verdict.passed, true)
same("the file is rerun alone, once", outside.asked, [file])
same(
  "its race is recorded with the test, its failure output and nothing else",
  outside.records.map((race) => [race.test.file, race.test.name, race.excerpt.includes("expected undefined to be 1")]),
  [[file, testName, true]],
)
same("both results are printed, and the second names the race and its record", outside.said, [
  `unit-tests: ${file} failed in the gate: ${testName}`,
  `unit-tests: ${file} passed alone, so it has a race. This branch does not change it, so the race is recorded in ${issueUrl} and the push goes on.`,
])
same(
  "the verdict names the record",
  outside.verdict.how,
  `every failed test file passed alone and is outside this branch; each race is recorded in ${issueUrl}`,
)
neverLoad("a race outside the diff", outside)

const unrecorded = await judged({
  status: 1,
  output: vitestOutput,
  recorded: { why: "gh issue create failed: HTTP 403" },
})
same("a race that could not be recorded stops the push", unrecorded.verdict.passed, false)
if (!unrecorded.verdict.how.includes("HTTP 403"))
  throw new Error(`the stop does not say why: ${unrecorded.verdict.how}`)
neverLoad("an unrecorded race", unrecorded)

const inside = await judged({ status: 1, output: vitestOutput, changed: [file, "apps/api/src/agent-commit.ts"] })
same("a test inside the diff that passes alone stops the push", inside.verdict.passed, false)
same("and records nothing, since the branch owns the race", inside.records, [])
same(
  "and says the branch changes it",
  inside.said.at(-1),
  `unit-tests: ${file} passed alone, so it has a race, and this branch changes it.`,
)
if (!inside.verdict.how.includes(file) || !inside.verdict.how.includes(forceTheGap)) {
  throw new Error(`the stop does not say to force the gap: ${inside.verdict.how}`)
}
if (!forceTheGap.includes("every time") || !forceTheGap.includes("5 times")) {
  throw new Error(`forcing the gap must fail the old code every time and pass the fix 5 times: ${forceTheGap}`)
}
neverLoad("a race inside the diff", inside)

const real = await judged({
  status: 1,
  output: vitestOutput,
  alone: { status: 1, output: plainFailure() },
})
function plainFailure() {
  return ` FAIL  api ${file} > an agent edit > lands once\nAssertionError: expected undefined to be 1\n`
}
same("a test that fails alone too is a fault", real.verdict.passed, false)
same("and is not recorded as a race", real.records, [])
if (!real.verdict.how.includes(file) || !real.verdict.how.includes("lands once")) {
  throw new Error(`the stop does not name the failing test: ${real.verdict.how}`)
}
same(
  "the second result is printed",
  real.said.at(-1),
  `unit-tests: ${file} failed alone too, so this is a fault: an agent edit > lands once`,
)
neverLoad("a fault", real)

const lint = await judged({ status: 1, output: "fail lint 2s\nfailed: lint\n" })
same("a step that is not a test step stops the push", lint.verdict.passed, false)
same("and reruns nothing", lint.asked, [])
if (!lint.verdict.how.includes("lint")) throw new Error("the stop does not name the step")
neverLoad("a failed rule step", lint)

const next = await judged({ status: 1, output: `${vitestOutput}\nfailed: unit-tests, typecheck\n` })
same("unit-tests failing next to another step stops the push", [next.verdict.passed, next.asked], [false, []])

const silent = await judged({ status: 1, output: "failed: unit-tests\n" })
same("a failed test with no file named stops the push", silent.verdict.passed, false)

const nothing = await judged({ status: 1, output: "the machine fell over\n" })
same("a failed check that names no step stops the push", nothing.verdict.passed, false)

const two = await judged({
  status: 1,
  output: `${vitestOutput}\n FAIL  unit packages/live/src/x.test.ts > a > b\nError: boom\n`,
  alone: (test) =>
    test.startsWith("apps")
      ? { status: 0, output: "" }
      : { status: 1, output: ` FAIL  unit ${test} > a > b\nError: boom\n` },
})
same("one race and one fault is a fault", two.verdict.passed, false)
same("every failed file is rerun", two.asked, [file, "packages/live/src/x.test.ts"])
same(
  "the race is still recorded",
  two.records.map((race) => race.test.file),
  [file],
)

same("a file rerun alone runs niced on two workers in the small lane", checkSteps.aloneCommand(file), [
  "nice",
  ["-n", "10", "node", "scripts/selected-unit-tests.mjs", "2", file],
  { AIRDESIGN_REPLAY_ONLY: "1", AIRDESIGN_SPEC_CACHE: specCache },
])

const [saveStatus] = failedTests(saveStatusLog)
const saveStatusExcerpt = failureExcerpt(saveStatusLog, saveStatus)
same(
  "the save-status queue failure's excerpt keeps its error and stops before the next test",
  [
    saveStatusExcerpt.split("\n")[0],
    saveStatusExcerpt.includes('Expected: "Saving…"'),
    saveStatusExcerpt.includes('Received: "Saved"'),
    saveStatusExcerpt.includes("save-status.spec.ts:225:36"),
    saveStatusExcerpt.includes("[220/234]"),
  ],
  [
    "1) tests/browser/save-status.spec.ts:206:3 › an added slide reads Saving while its commit waits and Saved once the server takes it",
    true,
    true,
    true,
    false,
  ],
)
same(
  "a race's title names the file, the line and the test",
  raceTitle(saveStatus),
  "Race: tests/browser/save-status.spec.ts:206 › an added slide reads Saving while its commit waits and Saved once the server takes it",
)
same("a vitest race's title has no line", raceTitle({ file, name: "a > b" }), `Race: ${file} › a > b`)

const issues = () => {
  const open = []
  const calls = []
  const gh = (args, input) => {
    calls.push({ args, input })
    if (args[0] === "issue" && args[1] === "list") return { status: 0, stdout: JSON.stringify(open), stderr: "" }
    if (args[0] === "issue" && args[1] === "create") {
      const number = 990 + open.length
      open.push({ number, title: args[args.indexOf("--title") + 1], url: `${issueUrl.slice(0, -3)}${number}` })
      return { status: 0, stdout: `${open.at(-1).url}\n`, stderr: "" }
    }
    if (args[0] === "issue" && args[1] === "comment")
      return { status: 0, stdout: `${issueUrl}#issuecomment-1\n`, stderr: "" }
    return { status: 1, stdout: "", stderr: `unexpected gh ${args.join(" ")}` }
  }
  return { gh, calls, open }
}
const replay = issues()
const seen = (sha) => ({
  gh: replay.gh,
  repository: "Rickvu309/AirDesign",
  test: saveStatus,
  excerpt: saveStatusExcerpt,
  commit: sha,
  seen: "in ci run https://github.com/Rickvu309/AirDesign/actions/runs/19",
})
const first = recordRace(seen("e05168b79aaa"))
const again = recordRace(seen("a7e595902bbb"))
same("the save-status race is one issue across its failures", [first, again], [{ url: issueUrl }, { url: issueUrl }])
const created = replay.calls.find((call) => call.args[1] === "create")
const commented = replay.calls.find((call) => call.args[1] === "comment")
same(
  "the issue speaks for the owner and carries the test, the commit, the failure output and how to prove the race",
  [
    created.input.startsWith("🤖 **AI Agent responding on behalf of Quan Vu**"),
    created.input.includes("tests/browser/save-status.spec.ts:206"),
    created.input.includes("e05168b79aaa"),
    created.input.includes('Received: "Saved"'),
    created.input.includes(forceTheGap),
    /\bload\b/i.test(created.input),
  ],
  [true, true, true, true, true, false],
)
same(
  "the second failure comments with its own commit and output",
  [commented.args.slice(0, 3), commented.input.includes("a7e595902bbb"), commented.input.includes('Received: "Saved"')],
  [["issue", "comment", "990"], true, true],
)

const broken = recordRace({ ...seen("c"), gh: () => ({ status: 1, stdout: "", stderr: "gh: not logged in" }) })
same("a race gh cannot record says why", broken, { why: "the open issues could not be read: gh: not logged in" })

console.log("land-check tests passed")
