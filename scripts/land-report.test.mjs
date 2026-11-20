import fs from "node:fs"
import { ciFailureLines } from "./land-report.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual, null, 1)}\n${JSON.stringify(expected, null, 1)}`)
  }
}
const fixture = (name) => fs.readFileSync(new URL(`./land-fixtures/${name}`, import.meta.url), "utf8")
const ok = (stdout) => ({ status: 0, stdout, stderr: "" })

const queueRun = {
  id: 43261070420,
  event: "merge_group",
  branch: "gh-readonly-queue/main/pr-400-19e91f75084914dca3801292183decf0304af526",
  createdAt: "2026-11-12T16:30:00Z",
}
const oneFile = "apps/api/src/agent-commit-race.test.ts"

const lines = (changedOnMain, behind = 3) => {
  const gitCalls = []
  const out = ciFailureLines({
    repository: "Rickvu309/AirDesign",
    run: queueRun,
    gh: (args) => {
      if (args[0] === "api" && args[1].endsWith("/jobs?per_page=100"))
        return ok('[{"id":135322156039,"name":"check (source)"},{"id":135324262611,"name":"ci-gate"}]')
      if (args[0] === "api" && args[1].endsWith("/jobs/135322156039/logs")) return ok(fixture("vitest-failed.log"))
      if (args[0] === "api" && args[1].endsWith("/jobs/135324262611/logs")) return ok("failed: ci-gate\n")
      if (args[0] === "api" && args[1].endsWith("/artifacts")) return ok("test-results-check-main\n")
      throw new Error(`unexpected gh ${args.join(" ")}`)
    },
    git: (args) => {
      gitCalls.push(args.join(" "))
      if (args[0] === "merge-base") return ok(args[1] + "\n")
      if (args[0] === "rev-list") return ok(`${behind}\n`)
      if (args[0] === "diff") return ok(changedOnMain.join("\n") + "\n")
      if (args[0] === "cat-file") return ok("")
      throw new Error(`unexpected git ${args.join(" ")}`)
    },
  })
  return { out, gitCalls }
}

const fixed = lines([oneFile, "README.md"])
same(
  "the run is named with the failed step of each failed job",
  fixed.out[0],
  "ci run 43261070420 (merge_group) failed in unit-tests, ci-gate.",
)
same(
  "each failed test is named with its first error",
  fixed.out[1],
  `  ${oneFile}: an agent edit that meets a person's edit on another element while it is stored > lands once when the deck's index arrives between the read and the write, and counts one tool call`,
)
same(
  "the first error line follows",
  fixed.out[2],
  "    AssertionError: expected undefined to be 1 // Object.is equality",
)
same(
  "the kept test results are named",
  fixed.out.includes(
    "kept test results: test-results-check-main (gh run download 43261070420 -n test-results-check-main)",
  ),
  true,
)
same(
  "main moved and the file changed there: say rebase",
  fixed.out.includes(
    `main has moved 3 commits since this run started, and ${oneFile} changed on main since. A fix may have landed. Do not rerun the job: git fetch origin main && git rebase origin/main && pnpm land`,
  ),
  true,
)
same(
  "the run's main is the base in the queue branch's name",
  fixed.gitCalls.includes("rev-list --count 19e91f75084914dca3801292183decf0304af526..origin/main"),
  true,
)

const unchanged = lines(["README.md"])
same(
  "main moved but the file did not change: say so",
  unchanged.out.includes(
    `main has moved 3 commits since this run started, but ${oneFile} did not change on main. A rerun would test the same code: fix the test or the code.`,
  ),
  true,
)

const still = lines([], 0)
same(
  "main has not moved: a rerun would test the same snapshot",
  still.out.includes(
    "main has not moved since this run started. A rerun would test the same snapshot: fix the test or the code.",
  ),
  true,
)

const reportFor = (jobName, log) =>
  ciFailureLines({
    repository: "Rickvu309/AirDesign",
    run: queueRun,
    gh: (args) => {
      if (args[0] === "api" && args[1].endsWith("/jobs?per_page=100")) return ok(`[{"id":1,"name":"${jobName}"}]`)
      if (args[0] === "api" && args[1].endsWith("/jobs/1/logs")) return ok(log)
      if (args[0] === "api" && args[1].endsWith("/artifacts")) return ok("")
      throw new Error(`unexpected gh ${args.join(" ")}`)
    },
    git: (args) => (args[0] === "rev-list" ? ok("0\n") : args[0] === "merge-base" ? ok(`${args[1]}\n`) : ok("")),
  })

const script = reportFor("check (scripts)", fixture("job-script-test-failed.log"))
same("a failed script test is named with the file and the error it threw", script.slice(0, 3), [
  "ci run 43261070420 (merge_group) failed in script-tests.",
  "  scripts/rule-table.test.mjs: (the whole file)",
  "    Error: CHECKS.md is under the file-size limit",
])
same(
  "a named script test does not say that no test was named",
  script.some((line) => line.includes("no failed test was named")),
  false,
)
same(
  "main has not moved, and the report names the script test file",
  script.at(-1),
  "main has not moved since this run started. A rerun would test the same snapshot: fix the test or the code.",
)

const ruleStep = reportFor("check (main)", fixture("job-file-size-failed.log"))
same("a rule step that failed names what it printed", ruleStep.slice(0, 2), [
  "ci run 43261070420 (merge_group) failed in file-size.",
  "  file-size: CHECKS.md is 5042 tokens, over the limit of 5000, and this change adds 126. Move one idea out of it into a new file beside it, named after what the new file holds, and import it from there. Leave the rest where it is.",
])

const manyFaults = reportFor("check (main)", fixture("job-copy-literals-failed.log"))
same(
  "a rule step with many faults names three and counts the rest",
  manyFaults.slice(1, 6).map((line) => line.replace(/ is product copy\..*/, "")),
  [
    "  copy-literals:",
    '    tests/browser/save-failure.spec.ts:16: "End"',
    '    tests/browser/save-failure.spec.ts:19: "Unable to save"',
    '    tests/browser/save-failure.spec.ts:27: "Reload"',
    "    and 6 more",
  ],
)

const build = reportFor("check (main)", fixture("job-typescript-build-failed.log"))
same(
  "a TypeScript error is named in the report",
  build[2],
  "    src/design/controls/text.test.tsx(158,43): error TS2769: No overload matches this call.",
)

const silent = reportFor("check (main)", "failed: unit-tests\n")
same(
  "a log with no cause still says to read it",
  silent[1],
  "  no failed test was named in the log. Read it with: gh run view 43261070420 --log-failed",
)
