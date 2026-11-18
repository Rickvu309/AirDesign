import fs from "node:fs"
import { checkSteps, specCache } from "./check-steps.mjs"
import { judgeCheck } from "./land-check.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual, null, 1)}\n${JSON.stringify(expected, null, 1)}`)
  }
}
const fixture = (name) => fs.readFileSync(new URL(`./land-fixtures/${name}`, import.meta.url), "utf8")
const vitestOutput = fixture("vitest-failed.log")
const file = "apps/api/src/agent-commit-race.test.ts"

const judged = async ({ status, output, alone = { status: 0, output: "" } }) => {
  const said = []
  const asked = []
  const verdict = await judgeCheck({
    status,
    output,
    rerun: async (test) => {
      asked.push(test)
      return typeof alone === "function" ? alone(test) : alone
    },
    say: (line) => said.push(line),
  })
  return { verdict, said, asked }
}

const passing = await judged({ status: 0, output: "ok lint 1s\n" })
same("a gate that passed is passed", passing.verdict, { passed: true, how: "the gate passed" })
same("a passing check reruns nothing", passing.asked, [])

const load = await judged({ status: 1, output: vitestOutput, alone: { status: 0, output: "1 passed" } })
same("a test that fails in the gate and passes alone is load", load.verdict.passed, true)
same("the file is rerun alone, once", load.asked, [file])
same("both results are printed", load.said, [
  `test: ${file} failed in the gate: an agent edit that meets a person's edit on another element while it is stored > lands once when the deck's index arrives between the read and the write, and counts one tool call`,
  `test: ${file} passed alone. This looks like machine load, not a fault.`,
])
if (!load.verdict.how.includes("passed alone")) throw new Error("the verdict does not say the file passed alone")

const real = await judged({
  status: 1,
  output: vitestOutput,
  alone: { status: 1, output: plainFailure() },
})
function plainFailure() {
  return ` FAIL  api ${file} > an agent edit > lands once\nAssertionError: expected undefined to be 1\n`
}
same("a test that fails alone too is a fault", real.verdict.passed, false)
if (!real.verdict.how.includes(file) || !real.verdict.how.includes("lands once")) {
  throw new Error(`the stop does not name the failing test: ${real.verdict.how}`)
}
same(
  "the second result is printed",
  real.said.at(-1),
  `test: ${file} failed alone too, so this is a real fault: lands once`.replace(
    "lands once",
    "an agent edit > lands once",
  ),
)

const lint = await judged({ status: 1, output: "fail lint 2s\nfailed: lint\n" })
same("a step that does not depend on load stops the push", lint.verdict.passed, false)
same("and reruns nothing", lint.asked, [])
if (!lint.verdict.how.includes("lint")) throw new Error("the stop does not name the step")

const next = await judged({ status: 1, output: `${vitestOutput}\nfailed: test, typecheck\n` })
same("test failing next to another step stops the push", [next.verdict.passed, next.asked], [false, []])

const silent = await judged({ status: 1, output: "failed: test\n" })
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
same("one file load and one fault is a fault", two.verdict.passed, false)
same("every failed file is rerun", two.asked, [file, "packages/live/src/x.test.ts"])

same("a file rerun alone runs niced on two workers in the small lane", checkSteps.aloneCommand(file), [
  "nice",
  ["-n", "10", "node", "node_modules/vitest/vitest.mjs", "run", "--maxWorkers=2", file],
  { AIRDESIGN_REPLAY_ONLY: "1", AIRDESIGN_SPEC_CACHE: specCache },
])
