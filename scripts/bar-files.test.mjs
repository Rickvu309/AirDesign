import { judges } from "./bar-files.mjs"
import { labelsFor, readReasons, verdict } from "./bar.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const metrics = JSON.stringify({ "ci-duration": { limit: 40 } })
const judged = ({ listed, fork = {}, head = {} }) => {
  const sides = { fork: { "metrics.json": metrics, ...fork }, head: { "metrics.json": metrics, ...head } }
  const reasons = readReasons({ text: (sha, file) => sides[sha][file], fork: "fork", head: "head", listed })
  return {
    labels: labelsFor(verdict({ reasons })),
    lowers: reasons.filter((reason) => reason.lowers).map((r) => r.text),
  }
}
const changed = (status) => (name) => ({ name, status })
const added = changed("added")
const modified = changed("modified")
const removed = changed("removed")
const quiet = { labels: [], lowers: [] }
const changesCi = { labels: ["changes-ci"], lowers: [] }

same(
  "PR 935 adds a PowerPoint case module, which changes nothing ci judges by",
  judged({ listed: [added("scripts/pptx-cases/picture-mode.mjs"), modified("packages/pptx/src/fill.ts")] }),
  quiet,
)
same(
  "PR 936 adds a case and its test",
  judged({ listed: [modified("scripts/pptx-cases.test.mjs"), added("scripts/pptx-cases/smart-animate.mjs")] }),
  quiet,
)
same(
  "PR 925 changes a spec, its replay and the code each spec covers",
  judged({
    listed: [
      modified("specs/edit/Edit.tla"),
      modified("specs/edit/Edit.cfg"),
      modified("specs/edit/view.mjs"),
      modified("specs/agents/covers.json"),
    ],
    fork: { "specs/edit/Edit.cfg": "SPECIFICATION Spec\nINVARIANT TypeOK\n" },
    head: { "specs/edit/Edit.cfg": "SPECIFICATION Spec\nINVARIANT TypeOK\nINVARIANT AgentSawCurrent\n" },
  }),
  quiet,
)
same(
  "PR 933 changes the failure report, the land tools, their tests and a log fixture",
  judged({
    listed: [
      modified("scripts/ci-failure-report.mjs"),
      modified("scripts/failed-tests.mjs"),
      added("scripts/job-logs.mjs"),
      modified("scripts/land-follow.mjs"),
      modified("scripts/land-report.mjs"),
      modified("scripts/queue-drop.mjs"),
      modified("scripts/land.mjs"),
      modified("scripts/machine-lock.mjs"),
      added("scripts/land-fixtures/job-deck-status-failed.log"),
      modified("scripts/queue-drop.test.mjs"),
    ],
  }),
  quiet,
)
same(
  "PR 941 rewords a note beside the fixtures, which no check reads",
  judged({ listed: [modified("scripts/pptx-fixtures/effect-graph.md")] }),
  quiet,
)
same(
  "PR 912 changes the rule docs only",
  judged({ listed: [modified("AGENTS.md"), modified("CHECKS.md"), modified("COMMANDS.md")] }),
  quiet,
)
same(
  "PR 940 changes a workflow",
  judged({
    listed: [modified(".github/workflows/ci-failure-report.yml")],
    fork: { ".github/workflows/ci-failure-report.yml": "jobs:\n  report:\n    runs-on: x\n" },
    head: { ".github/workflows/ci-failure-report.yml": "jobs:\n  report:\n    runs-on: y\n" },
  }),
  changesCi,
)
same(
  "PR 889 lowers a browser test timeout, which is stricter",
  judged({
    listed: [modified("playwright.config.ts")],
    fork: { "playwright.config.ts": "  timeout: 300_000,\n" },
    head: { "playwright.config.ts": "  timeout: 180_000,\n" },
  }),
  changesCi,
)
for (const file of [
  "scripts/check-steps.mjs",
  "scripts/check.mjs",
  "scripts/gate.mjs",
  "scripts/metrics.mjs",
  "scripts/pptx-check.mjs",
  "scripts/pr-body.mjs",
  "scripts/pptx-judge/Program.cs",
  ".github/actions/affected-report/action.yml",
  ".github/pull_request_template.md",
  "tooling/oxlint-plugin-airdesign/glossary.json",
  "packages/pptx/tsconfig.json",
  "apps/web/.oxlintrc.json",
  "vitest.config.mts",
]) {
  same(`a change to ${file} changes what ci judges`, judged({ listed: [modified(file)] }).labels, ["changes-ci"])
}
same(
  "an added package script changes nothing that runs",
  judged({
    listed: [modified("package.json")],
    fork: { "package.json": JSON.stringify({ scripts: { lint: "oxlint" } }) },
    head: { "package.json": JSON.stringify({ scripts: { lint: "oxlint", "new:thing": "node x.mjs" } }) },
  }),
  quiet,
)
same(
  "a changed package script changes what ci runs",
  judged({
    listed: [modified("package.json")],
    fork: { "package.json": JSON.stringify({ scripts: { lint: "oxlint" } }) },
    head: { "package.json": JSON.stringify({ scripts: { lint: "oxlint --quiet" } }) },
  }).labels,
  ["changes-ci"],
)

same(
  "PR 903 swaps one spec invariant for a stronger one",
  judged({
    listed: [modified("specs/connection/Connection.cfg")],
    fork: { "specs/connection/Connection.cfg": "INVARIANT TypeOK\nINVARIANT SavedOnlyWhileSending\n" },
    head: { "specs/connection/Connection.cfg": "INVARIANT TypeOK\nINVARIANT SavedOnlyWhenLanded\n" },
  }),
  quiet,
)

same(
  "a skip named inside a string is no skipped test",
  judged({
    listed: [modified("scripts/bar-files.test.mjs")],
    fork: { "scripts/bar-files.test.mjs": "const cases = []\n" },
    head: { "scripts/bar-files.test.mjs": "const cases = ['test.skip(\"saves\")']\n" },
  }),
  quiet,
)

same(
  "PR 825 renames check steps and keeps what each runs",
  judged({
    listed: [modified("scripts/check-steps.mjs")],
    fork: {
      "scripts/check-steps.mjs":
        '  { name: "stale-tree", kind: "rule", command: "node", args: ["scripts/stale-tree.mjs"] },\n',
    },
    head: {
      "scripts/check-steps.mjs":
        '  { name: "restored-files", kind: "rule", command: "node", args: ["scripts/stale-tree.mjs"] },\n',
    },
  }).lowers,
  [],
)
same(
  "PR 727 moves an invariant out of the known failures once it holds",
  judged({
    listed: [modified("specs/connection/Connection.known.cfg")],
    fork: { "specs/connection/Connection.known.cfg": "INVARIANT TypeOK\nINVARIANT SavedWhenSettled\n" },
    head: { "specs/connection/Connection.known.cfg": "INVARIANT TypeOK\n" },
  }),
  quiet,
)
same(
  "PR 791 writes a skipped test into a fixture from a script test",
  judged({
    listed: [modified("scripts/browser-timings.test.mjs")],
    fork: { "scripts/browser-timings.test.mjs": "`\ntest('passes', async () => {})\n`\n" },
    head: {
      "scripts/browser-timings.test.mjs": "`\ntest('passes', async () => {})\ntest.skip('skips', async () => {})\n`\n",
    },
  }),
  quiet,
)

const lowered = (name, change, text) => {
  const result = judged(change)
  same(name, result, { labels: ["changes-ci", "lowers-the-bar"], lowers: [text] })
}
lowered(
  "PR 888 replaces a deck the PowerPoint check judges",
  { listed: [modified("scripts/pptx-fixtures/picture-png.pptx")] },
  "scripts/pptx-fixtures/picture-png.pptx is a deck the PowerPoint check already judges.",
)
lowered(
  "a removed case module",
  { listed: [removed("scripts/pptx-cases/picture-mode.mjs")] },
  "The PowerPoint case scripts/pptx-cases/picture-mode.mjs was removed.",
)
const steps = (rows) =>
  rows.map((row) => `  {\n    name: "${row[0]}",\n    kind: "${row[1]}",${row[2] ?? ""}\n  },`).join("\n")
lowered(
  "a removed check step",
  {
    listed: [modified("scripts/check-steps.mjs")],
    fork: {
      "scripts/check-steps.mjs": steps([
        ["lint", "rule"],
        ["typecheck", "rule"],
      ]),
    },
    head: { "scripts/check-steps.mjs": steps([["lint", "rule"]]) },
  },
  "The check step typecheck was removed.",
)
lowered(
  "a check step made a warning",
  {
    listed: [modified("scripts/check-steps.mjs")],
    fork: { "scripts/check-steps.mjs": steps([["lint", "rule"]]) },
    head: { "scripts/check-steps.mjs": steps([["lint", "rule", '\n    verdict: "warn",']]) },
  },
  "The check step lint no longer blocks.",
)
lowered(
  "a check step moved off ci",
  {
    listed: [modified("scripts/check-steps.mjs")],
    fork: { "scripts/check-steps.mjs": steps([["lint", "rule"]]) },
    head: { "scripts/check-steps.mjs": steps([["lint", "rule", '\n    where: "local",']]) },
  },
  "The check step lint now runs only local.",
)
lowered(
  "a removed workflow job",
  {
    listed: [modified(".github/workflows/ci.yml")],
    fork: { ".github/workflows/ci.yml": "on: push\njobs:\n  check:\n    steps: []\n  corpus:\n    steps: []\n" },
    head: { ".github/workflows/ci.yml": "on: push\njobs:\n  check:\n    steps: []\n" },
  },
  "The job corpus in .github/workflows/ci.yml was removed.",
)
lowered(
  "a job that no longer waits on another",
  {
    listed: [modified(".github/workflows/ci.yml")],
    fork: { ".github/workflows/ci.yml": "jobs:\n  ci:\n    needs: [check, corpus]\n" },
    head: { ".github/workflows/ci.yml": "jobs:\n  ci:\n    needs: [check]\n" },
  },
  "A job in .github/workflows/ci.yml no longer needs corpus.",
)
lowered(
  "a dropped spec invariant",
  {
    listed: [modified("specs/edit/Edit.cfg")],
    fork: { "specs/edit/Edit.cfg": "SPECIFICATION Spec\nINVARIANT TypeOK\nINVARIANT StopFences\n" },
    head: { "specs/edit/Edit.cfg": "SPECIFICATION Spec\nINVARIANT TypeOK\n" },
  },
  "specs/edit/Edit.cfg no longer checks StopFences.",
)
lowered(
  "a skipped test",
  {
    listed: [modified("apps/web/src/save.test.ts")],
    fork: { "apps/web/src/save.test.ts": 'test("saves", () => {})\n' },
    head: { "apps/web/src/save.test.ts": 'test.skip("saves", () => {})\n' },
  },
  "apps/web/src/save.test.ts skips 1 more test.",
)
lowered(
  "a raised limit in a check",
  {
    listed: [modified("scripts/file-size.mjs")],
    fork: { "scripts/file-size.mjs": "export const tokenLimit = 5000\n" },
    head: { "scripts/file-size.mjs": "export const tokenLimit = 6000\n" },
  },
  "In scripts/file-size.mjs, export const tokenLimit = 5000 became export const tokenLimit = 6000.",
)
lowered(
  "a lint rule turned down",
  {
    listed: [modified("apps/web/.oxlintrc.json")],
    fork: { "apps/web/.oxlintrc.json": JSON.stringify({ rules: { "react/rules-of-hooks": "error" } }) },
    head: { "apps/web/.oxlintrc.json": JSON.stringify({ rules: { "react/rules-of-hooks": "warn" } }) },
  },
  "The lint rule react/rules-of-hooks no longer fails in apps/web/.oxlintrc.json.",
)
lowered(
  "a strict type option turned off",
  {
    listed: [modified("tsconfig.base.json")],
    fork: { "tsconfig.base.json": JSON.stringify({ compilerOptions: { strict: true } }) },
    head: { "tsconfig.base.json": JSON.stringify({ compilerOptions: { strict: false } }) },
  },
  "tsconfig.base.json turned off strict.",
)

for (const file of [
  ".github/workflows/ci.yml",
  "tooling/oxlint-plugin-airdesign/rules/no-raw.js",
  "scripts/metrics.mjs",
  "scripts/pptx-check.mjs",
  "scripts/pptx-tools.sh",
  "scripts/pptx-judge/Program.cs",
  "tsconfig.base.json",
  "packages/pptx/tsconfig.json",
  "apps/web/.oxlintrc.json",
  ".oxfmtrc.json",
  "vitest.config.mts",
  "apps/web/vitest.config.ts",
  "playwright.config.ts",
  "vitest.workspace.ts",
]) {
  if (!judges(file)) throw new Error(`${file} decides ci and is not listed`)
}
for (const file of [
  "apps/web/src/App.tsx",
  "packages/pptx/src/slide-route.ts",
  "scripts/pptx-fixtures/cases.json",
  "metrics.json",
  "AGENTS.md",
  "pnpm-workspace.yaml",
  ".npmrc",
  "specs/edit/Edit.cfg",
  "scripts/pptx-cases/frame.mjs",
  "scripts/land-report.mjs",
]) {
  if (judges(file)) throw new Error(`${file} is product, data, a case, a spec or a doc and is listed`)
}
console.log("bar file tests passed")
