import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"
import { ciParts, pptxPathsFile } from "./change-map.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const same = (name, actual, expected) => assert.deepEqual(actual, expected, name)
const workflow = parse(fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8"))
const action = parse(fs.readFileSync(path.join(root, ".github/actions/ci-changes/action.yml"), "utf8"))
const changes = workflow.jobs.changes
const mapStep = changes.steps.find((step) => step.id === "map")
const checkJobs = JSON.parse(mapStep.with["check-jobs"])

const git = (folder, ...args) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: folder, encoding: "utf8" }).trim()

const repo = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-ci-changes-"))
const tracked = git(root, "ls-files", "-z")
  .split("\0")
  .filter((file) => file && fs.existsSync(path.join(root, file)))
for (const file of tracked) {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
  if (path.basename(file).startsWith(".git") || file === "scripts/change-map.mjs")
    fs.copyFileSync(path.join(root, file), path.join(repo, file))
  else fs.symlinkSync(path.join(root, file), path.join(repo, file))
}
git(repo, "init", "-q", "-b", "main")
git(repo, "add", "-A")
git(repo, "commit", "-q", "-m", "base")
const start = git(repo, "rev-parse", "HEAD")

const touch = (files, edit = (before) => `${before}\n`) => {
  for (const file of files) {
    const at = path.join(repo, file)
    const before = fs.existsSync(at) ? fs.readFileSync(at, "utf8") : ""
    fs.rmSync(at, { force: true })
    fs.mkdirSync(path.dirname(at), { recursive: true })
    fs.writeFileSync(at, edit(before))
  }
  git(repo, "add", "-A")
  git(repo, "commit", "-q", "--allow-empty", "-m", "change")
}

const step = (event) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-ci-changes-run-"))
  try {
    const output = path.join(temp, "output")
    const result = spawnSync("bash", ["-c", action.runs.steps[0].run], {
      cwd: repo,
      encoding: "utf8",
      env: {
        ...process.env,
        EVENT_NAME: event,
        CHECK_JOBS: mapStep.with["check-jobs"],
        GITHUB_OUTPUT: output,
        RUNNER_TEMP: temp,
      },
    })
    assert.equal(result.status, 0, result.stderr)
    return Object.fromEntries(
      fs
        .readFileSync(output, "utf8")
        .trim()
        .split("\n")
        .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
    )
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
}

const pullRequest = (files, edit) => {
  git(repo, "checkout", "-q", "--detach", start)
  touch(files, edit)
  return step("pull_request")
}

const partsOn = (said) => ciParts.filter((part) => said[part] === "true")
const jobsOf = (said) => JSON.parse(said.check).map((job) => [job.part, job.shard ?? ""].join(" ").trim())
const everyJob = checkJobs.map((job) => [job.part, job.shard ?? ""].join(" ").trim())

try {
  const docs = pullRequest(["GLOSSARY.md"])
  same(
    "895aee5b4, a glossary row, runs only source and scripts, with no unit test folder and no model check",
    [partsOn(docs), jobsOf(docs), docs["unit-tests"], docs["model-check"]],
    [["source", "scripts"], ["source", "scripts"], "[]", "false"],
  )

  const spec = pullRequest(["tests/browser/grid-last-faults.spec.ts"])
  same(
    "69807ec35, one non-export browser spec, runs one browser job and skips PowerPoint checks",
    [partsOn(spec), jobsOf(spec), JSON.parse(spec.check).at(-1).browserSpecs, spec["unit-tests"]],
    [["source", "browser"], ["source", "browser"], ["tests/browser/grid-last-faults.spec.ts"], "[]"],
  )

  const exported = pullRequest(["tests/browser/box-export.spec.ts"])
  same(
    "a registered export spec runs one browser job and both PowerPoint parts",
    [partsOn(exported), jobsOf(exported)],
    [
      ["source", "browser", "pptx", "corpus"],
      ["source", "browser", "pptx"],
    ],
  )

  const removedTag = pullRequest(["tests/browser/box-export.spec.ts"], (source) => source.replaceAll("@export", ""))
  same(
    "removing the tag from a registered case still reaches the judge",
    [removedTag.pptx, removedTag.corpus],
    ["true", "true"],
  )

  const fixture = pullRequest(["tests/browser/font-widths.ts"])
  same(
    "a browser helper runs its importing specs and skips the other browser and PowerPoint work",
    [partsOn(fixture), jobsOf(fixture), JSON.parse(fixture.check).at(-1).browserSpecs],
    [
      ["source", "browser"],
      ["source", "browser"],
      [
        "tests/browser/font-widths.spec.ts",
        "tests/browser/slide-findings.spec.ts",
        "tests/browser/text-fit.spec.ts",
        "tests/browser/theme-findings.spec.ts",
      ],
    ],
  )

  for (const file of ["launch.ts", "deck-test.ts", "api-stack.ts", "font-preview.mjs", "preview-server.mjs"]) {
    const shared = pullRequest([`tests/browser/${file}`])
    same(
      `${file} runs the full browser matrix`,
      jobsOf(shared).filter((job) => job.startsWith("browser")),
      ["browser 1/4", "browser 2/4", "browser 3/4", "browser 4/4"],
    )
    same(`${file} also reaches PowerPoint`, [shared.pptx, shared.corpus], ["true", "true"])
  }

  const catalog = pullRequest(["packages/catalog/src/trait-wire-transition.ts"])
  same(
    "384e45760, a catalog source file, runs its importers' unit tests and the parts the app, api and site feed, and no pptx",
    [partsOn(catalog), JSON.parse(catalog["unit-tests"])],
    [
      ["source", "scripts", "design", "browser", "journeys"],
      [
        ".agents/skills/",
        "apps/api/",
        "apps/site/",
        "apps/web/",
        "packages/catalog/",
        "packages/engine/",
        "packages/live/",
        "packages/mcp/",
        "tests/",
      ],
    ],
  )

  const ci = pullRequest([
    ".github/workflows/ci.yml",
    "scripts/check-mutation.mjs",
    "scripts/check-mutation.rule.md",
    "scripts/check-mutation.test.mjs",
    "scripts/ci-crashes.test.mjs",
  ])
  same(
    "e9fddbc20, a CI change, runs every part, every check job and every unit test",
    [partsOn(ci), jobsOf(ci), ci["unit-tests"]],
    [ciParts, everyJob, "all"],
  )

  git(repo, "checkout", "-q", "--detach", start)
  touch(["packages/oauth/src/index.ts"])
  const pr = git(repo, "rev-parse", "HEAD")
  git(repo, "checkout", "-q", "--detach", start)
  touch(["packages/pptx/src/index.ts"])
  git(repo, "merge", "-q", "--no-ff", "-m", "merge", pr)
  same(
    "on GitHub's merge commit the base is the first parent, so a pptx change main made since the branch started runs no pptx part",
    partsOn(step("pull_request")).includes("pptx"),
    false,
  )

  for (const event of ["merge_group", "push"]) {
    git(repo, "checkout", "-q", "--detach", start)
    touch(["GLOSSARY.md"])
    const full = step(event)
    same(`a ${event} run passes --full and runs every part and job`, [partsOn(full), jobsOf(full)], [ciParts, everyJob])
  }

  git(repo, "checkout", "-q", "--orphan", "lonely")
  git(repo, "commit", "-q", "--allow-empty", "-m", "no parent")
  same("a diff that cannot be read runs every part", partsOn(step("pull_request")), ciParts)
} finally {
  fs.rmSync(repo, { recursive: true, force: true })
}

same("the changes job runs on every event", changes.if, undefined)
same("the changes job reads the merge commit and its first parent", changes.steps[0].with, { "fetch-depth": 2 })
same("the changes job uses the one action", mapStep.uses, "./.github/actions/ci-changes")
same("the changes job hands out each part, the unit test folders and the check jobs", Object.keys(changes.outputs), [
  ...ciParts,
  "unit-tests",
  "check",
])
same("the action exposes the same outputs", Object.keys(action.outputs), [...ciParts, "unit-tests", "check"])
same("no step reads the old pptx-changed action", JSON.stringify(workflow).includes("pptx-changed"), false)
same("the workflow keeps no second copy of a path list", JSON.stringify(workflow).includes("git diff --quiet"), false)

const check = workflow.jobs.check
same(
  "the check jobs are the ones changes lists",
  check.strategy.matrix.include,
  "${{ fromJSON(needs.changes.outputs.check) }}",
)
same("check waits for changes", check.needs, "changes")
same(
  "check is skipped only when changes lists no check job",
  check.if,
  "${{ !cancelled() && needs.changes.outputs.check != '[]' }}",
)
same(
  "every check job names a part the map decides",
  checkJobs.every((job) => ciParts.includes(job.part)),
  true,
)
const partCheck = check.steps.find((step) => (step.run ?? "").startsWith("pnpm check --part="))
same("the source part runs the unit test folders and model check that changes chose", partCheck.env, {
  AIRDESIGN_UNIT_TESTS: "${{ needs.changes.outputs.unit-tests }}",
  AIRDESIGN_MODEL_CHECK: "${{ needs.changes.outputs.model-check }}",
  AIRDESIGN_BROWSER_SPECS: "${{ toJSON(matrix.browserSpecs) }}",
})

const gated = {
  corpus: "${{ !cancelled() && needs.changes.outputs.corpus != 'false' }}",
  journeys: "${{ !cancelled() && github.event_name != 'push' && needs.changes.outputs.journeys != 'false' }}",
  "design-findings":
    "${{ !cancelled() && github.event_name == 'pull_request' && needs.changes.outputs.design != 'false' }}",
}
for (const [job, condition] of Object.entries(gated)) {
  same(
    `${job} runs unless changes said its part is false, so a missing output runs it`,
    workflow.jobs[job].if,
    condition,
  )
  same(`${job} waits for changes`, [workflow.jobs[job].needs].flat().includes("changes"), true)
}
const runs = (condition, said, event = "pull_request") =>
  new Function(
    `return ${condition
      .replace(/^\$\{\{\s*|\s*\}\}$/g, "")
      .replaceAll("!cancelled()", "true")
      .replaceAll("github.event_name", JSON.stringify(event))
      .replaceAll(/needs\.changes\.outputs\.([\w-]+)/g, (_, part) => JSON.stringify(said[part] ?? ""))}`,
  )()
same("a missing corpus output runs the corpus", runs(gated.corpus, {}), true)
same("corpus false skips the corpus", runs(gated.corpus, { corpus: "false" }), false)
same("journeys do not run on a push to main", runs(gated.journeys, { journeys: "true" }, "push"), false)
same("a missing check list does not skip check", runs(check.if, {}), true)

const pptxSteps = check.steps.filter((step) => (step.if ?? "").includes("matrix.part == 'pptx'"))
same(
  "the pptx job asks nothing more of the diff, since changes leaves it out when nothing it judges changed",
  pptxSteps.some((step) => /steps\.pptx/.test(step.if)),
  false,
)

const verdict = workflow.jobs.ci.steps.find((step) => step.env?.RESULTS !== undefined)
same("the verdict reads every result and the event", verdict.env, {
  RESULTS: "${{ toJSON(needs) }}",
  EVENT_NAME: "${{ github.event_name }}",
})
same("ci waits for every part", workflow.jobs.ci.needs.toSorted(), ["changes", "check", "corpus", "journeys"])
const said = (parts, jobs = checkJobs.filter((job) => parts[job.part] === "true")) => ({
  ...Object.fromEntries(ciParts.map((part) => [part, parts[part] ?? "false"])),
  check: JSON.stringify(jobs),
})
const passes = (results, event = "pull_request") => {
  const outcome = spawnSync("bash", ["-e", "-c", verdict.run], {
    encoding: "utf8",
    env: { ...process.env, RESULTS: JSON.stringify(results), EVENT_NAME: event },
  })
  return outcome.status === 0
}
const all = Object.fromEntries(ciParts.map((part) => [part, "true"]))
const ran = (outputs, results = {}) => ({
  changes: { result: "success", outputs },
  check: { result: "success" },
  corpus: { result: "success" },
  journeys: { result: "success" },
  ...results,
})
const docsOnly = said({ source: "true", scripts: "true" })
same("ci passes when every part ran and passed", passes(ran(said(all))), true)
same(
  "ci passes a docs-only change whose corpus and journeys changes skipped",
  passes(ran(docsOnly, { corpus: { result: "skipped" }, journeys: { result: "skipped" } })),
  true,
)
same(
  "ci fails a skipped corpus that changes said must run",
  passes(ran(said(all), { corpus: { result: "skipped" } })),
  false,
)
same(
  "ci fails skipped journeys that changes said must run",
  passes(ran(said(all), { journeys: { result: "skipped" } })),
  false,
)
same(
  "ci passes skipped journeys on a push to main",
  passes(ran(said(all), { journeys: { result: "skipped" } }), "push"),
  true,
)
same(
  "ci passes a skipped check job only when changes listed no check job",
  [
    passes(
      ran(said({}), { check: { result: "skipped" }, corpus: { result: "skipped" }, journeys: { result: "skipped" } }),
    ),
    passes(
      ran(docsOnly, { check: { result: "skipped" }, corpus: { result: "skipped" }, journeys: { result: "skipped" } }),
    ),
  ],
  [true, false],
)
same(
  "ci fails when changes said browser runs and left the browser jobs out of the list",
  passes(
    ran(
      said(
        all,
        checkJobs.filter((job) => job.part !== "browser"),
      ),
    ),
  ),
  false,
)
same("ci fails when changes failed", passes(ran(said(all), { changes: { result: "failure", outputs: {} } })), false)
same(
  "ci fails when changes was skipped",
  passes(ran(said(all), { changes: { result: "skipped", outputs: {} } })),
  false,
)
same("ci fails when changes gave no check list", passes(ran({ ...said(all), check: "" })), false)
same("ci fails when a check job failed", passes(ran(said(all), { check: { result: "failure" } })), false)
same("ci fails when the corpus was cancelled", passes(ran(said(all), { corpus: { result: "cancelled" } })), false)
same(
  "ci fails when the journeys failed or were cancelled",
  ["failure", "cancelled"].map((result) => passes(ran(said(all), { journeys: { result } }))),
  [false, false],
)

const pathsListed = fs.readFileSync(path.join(root, pptxPathsFile), "utf8").split("\n").filter(Boolean)
same("the pptx list holds each path once", new Set(pathsListed).size, pathsListed.length)
for (const entry of pathsListed) same(`${entry} exists`, fs.existsSync(path.join(root, entry)), true)

console.log("ci-changes: all assertions passed")
