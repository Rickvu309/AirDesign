import fs from "node:fs"
import { failedCauses, failedScripts, failedSteps, failedTests, plainLog } from "./failed-tests.mjs"

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

const pptxExport = fs.readFileSync(new URL("./red-main-fixtures/run-43778249943-corpus.log", import.meta.url), "utf8")
same(
  "the PowerPoint check's browser export spec names its failed test with no indent",
  failedTests(pptxExport).map((test) => [test.file, test.line, test.error]),
  [["tests/browser/gesture-size.spec.ts", 82, "Error: expect(received).toEqual(expected) // deep equality"]],
)

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

same(
  "a journey header loses the rule Playwright pads it with",
  failedTests(
    "2026-11-19T01:26:23.7716500Z   1) tests/journeys/journeys.spec.ts:88:3 › grid-group-add ─────────────────────────────────────────\n\n    Error: expect(locator).toHaveCount(expected) failed\n",
  ).map((test) => test.name),
  ["grid-group-add"],
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

const scriptJob = fixture("job-script-test-failed.log")
same("a script test file that threw is named with the error it threw", failedScripts(scriptJob), [
  {
    file: "scripts/rule-table.test.mjs",
    name: "(the whole file)",
    error: "Error: CHECKS.md is under the file-size limit",
  },
])
same("a script test file that threw is not a vitest or browser test", failedTests(scriptJob), [])
same(
  "a failed assertion is named by its message",
  failedScripts(
    "node:internal/modules/run_main:107\n    triggerUncaughtException(\n    ^\nAssertionError [ERR_ASSERTION]: shared execution stays whole\n+ actual - expected\n    at file:///x/scripts/affected-report.test.mjs:9:8\nNode.js v24.22.2\nfail scripts/affected-report.test.mjs\n[ELIFECYCLE] Command failed with exit code 1.\nfail script-tests 23.9s\n",
  ).map((test) => [test.file, test.error]),
  [["scripts/affected-report.test.mjs", "AssertionError [ERR_ASSERTION]: shared execution stays whole"]],
)
same(
  "a test file that printed a plain message before it exited is named by that message",
  failedScripts(
    "$ node scripts/tooling-tests.mjs\nthe first of two slots did not start\nfail scripts/machine-lock.test.mjs\nfail script-tests 3.0s\n",
  ),
  [{ file: "scripts/machine-lock.test.mjs", name: "(the whole file)", error: "the first of two slots did not start" }],
)
same(
  "two failed files each keep the error printed before their own line",
  failedScripts(
    "Error: first broke\n    at a (file:///a.test.mjs:1:1)\nfail scripts/a.test.mjs\nError: second broke\nfail scripts/b.test.mjs\nfail script-tests 3.0s\n",
  ).map((test) => [test.file, test.error]),
  [
    ["scripts/a.test.mjs", "Error: first broke"],
    ["scripts/b.test.mjs", "Error: second broke"],
  ],
)

same("a rule step names the line it printed", failedCauses(fixture("job-file-size-failed.log")), [
  {
    step: "file-size",
    lines: [
      "CHECKS.md is 5042 tokens, over the limit of 5000, and this change adds 126. Move one idea out of it into a new file beside it, named after what the new file holds, and import it from there. Leave the rest where it is.",
    ],
    more: 0,
  },
])
const copy = failedCauses(fixture("job-copy-literals-failed.log"))
same(
  "a rule step that lists many faults names the first three and counts the rest",
  [copy[0].step, copy[0].lines.length, copy[0].more],
  ["copy-literals", 3, 6],
)
same(
  "the first fault of a rule step comes first",
  copy[0].lines[0],
  'tests/browser/save-failure.spec.ts:16: "End" is product copy. Import connectionCopy.end from apps/web/src/copy/connection-copy.ts, so the test follows a change of words.',
)
same("a TypeScript error names its file, position and code", failedCauses(fixture("job-typescript-build-failed.log")), [
  {
    step: "build",
    lines: [
      "src/design/controls/text.test.tsx(158,43): error TS2769: No overload matches this call.",
      "src/design/controls/text.test.tsx(223,43): error TS2769: No overload matches this call.",
    ],
    more: 0,
  },
])
same(
  "a browser web server that did not start is named by Playwright's error",
  failedCauses(fixture("job-web-server-failed.log")),
  [{ step: "browser", lines: ["Error: Process from config.webServer was not able to start. Exit code: 1"], more: 0 }],
)
same("an oxlint error names its message", failedCauses(fixture("job-lint-failed.log")), [
  { step: "lint", lines: ["src/font-notice.ts:1:10: 'toast' import from 'sonner' is restricted."], more: 0 },
])
same("a log with no failed step has no cause", failedCauses("ok lint 1.2s\nok unit-tests 3.4s\n"), [])
