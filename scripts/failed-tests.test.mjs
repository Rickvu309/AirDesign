import fs from "node:fs"
import { failedSteps, failedTests, plainLog } from "./failed-tests.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual, null, 1)}\n${JSON.stringify(expected, null, 1)}`)
  }
}
const fixture = (name) => fs.readFileSync(new URL(`./land-fixtures/${name}`, import.meta.url), "utf8")

const vitest = fixture("vitest-failed.log")
const plain = plainLog(vitest)
if (/\u001b|check \(source\)|\d{4}-\d\d-\d\dT/.test(plain)) throw new Error("a CI line kept its job, time or colors")
same("a CI line keeps its words", plain.includes("fail unit-tests 208.7s"), true)
same("the failed steps come from the check's last line", failedSteps(vitest), ["unit-tests"])
same("the failed vitest test is named with its file, its path and its first error", failedTests(vitest), [
  {
    file: "apps/api/src/agent-commit-race.test.ts",
    name: "an agent edit that meets a person's edit on another element while it is stored > lands once when the deck's index arrives between the read and the write, and counts one tool call",
    error: "AssertionError: expected undefined to be 1 // Object.is equality",
  },
])

const playwright = fixture("playwright-failed.log")
same("a browser failure is a failed step", failedSteps(playwright), ["browser-tests"])
same("the failed browser test is named once, with its file and first error", failedTests(playwright), [
  {
    file: "tests/browser/real-save.spec.ts",
    name: "home import through the first typed edit opens the deck exactly once",
    error: "Error: expect(received).toHaveLength(expected)",
    line: 120,
  },
])

same("a log with no failure names nothing", failedTests("ok lint 1.2s\nok unit-tests 3.4s\n"), [])
same("several failed steps are all named", failedSteps("failed: unit-tests, browser-tests, typecheck\n"), [
  "unit-tests",
  "browser-tests",
  "typecheck",
])
same(
  "a whole file that failed to load is named without a test",
  failedTests(" FAIL  unit packages/x/src/y.test.ts [ packages/x/src/y.test.ts ]\nError: Cannot find module 'z'\n"),
  [{ file: "packages/x/src/y.test.ts", name: "(the whole file)", error: "Error: Cannot find module 'z'" }],
)

const job = fixture("job-playwright-failed.log")
same("a job log from the jobs API loses its time stamps", /^\d{4}-\d\d-\d\dT/m.test(plainLog(job)), false)
same("a job log names its failed step", failedSteps(job), ["browser-tests"])
same(
  "a job log names its failed browser test",
  failedTests(job).map((test) => [test.file, test.name, test.error]),
  [
    [
      "tests/browser/save-status.spec.ts",
      "an added slide reads Saving while its commit waits and Saved once the server takes it",
      "Error: expect(locator).toHaveText(expected) failed",
    ],
  ],
)
