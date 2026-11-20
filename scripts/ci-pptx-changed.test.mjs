import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const same = (name, actual, expected) => assert.deepEqual(actual, expected, name)
const workflow = parse(fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8"))
const actionFolder = path.join(root, ".github/actions/pptx-changed")
const action = parse(fs.readFileSync(path.join(actionFolder, "action.yml"), "utf8"))

const git = (folder, ...args) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: folder, encoding: "utf8" }).trim()

const changedAfter = (touched, { base } = {}) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-pptx-changed-"))
  try {
    git(folder, "init", "-q")
    fs.writeFileSync(path.join(folder, "README.md"), "start")
    git(folder, "add", ".")
    git(folder, "commit", "-q", "-m", "base")
    const baseSha = git(folder, "rev-parse", "HEAD")
    for (const file of touched) {
      fs.mkdirSync(path.dirname(path.join(folder, file)), { recursive: true })
      fs.writeFileSync(path.join(folder, file), "changed")
    }
    git(folder, "add", ".")
    git(folder, "commit", "-q", "--allow-empty", "-m", "change")
    const output = path.join(folder, "output")
    const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", action.runs.steps[0].run], {
      cwd: folder,
      encoding: "utf8",
      env: {
        ...process.env,
        BASE: base ?? baseSha,
        GITHUB_ACTION_PATH: actionFolder,
        GITHUB_OUTPUT: output,
      },
    })
    assert.equal(result.status, 0, result.stderr)
    return fs.readFileSync(output, "utf8").trim()
  } finally {
    fs.rmSync(folder, { recursive: true, force: true })
  }
}

for (const file of [
  "packages/pptx/src/write.ts",
  "packages/document/src/index.ts",
  "packages/render/src/paragraph.tsx",
  "apps/web/src/editor.tsx",
  "tests/browser/export.spec.ts",
  "scripts/pptx-fixtures/corpus.json",
  "pnpm-lock.yaml",
  ".github/workflows/ci.yml",
  ".github/actions/pptx-changed/paths.txt",
]) {
  same(`a change to ${file} counts as changed`, changedAfter([file]), "changed=1")
}
for (const file of ["docs/notes.md", "GLOSSARY.md", "apps/site/src/landing.tsx", "packages/usage/src/index.ts"]) {
  same(`a change to ${file} alone counts as unchanged`, changedAfter([file]), "changed=0")
}
same("an empty commit counts as unchanged", changedAfter([]), "changed=0")
same(
  "a base the diff cannot read counts as changed",
  changedAfter(["docs/notes.md"], { base: "missing-sha" }),
  "changed=1",
)
same("an empty base counts as changed", changedAfter(["docs/notes.md"], { base: "" }), "changed=1")

const pathsListed = fs.readFileSync(path.join(actionFolder, "paths.txt"), "utf8").split("\n").filter(Boolean)
same("the list holds each path once", new Set(pathsListed).size, pathsListed.length)
for (const entry of pathsListed) {
  same(`${entry} exists`, fs.existsSync(path.join(root, entry)), true)
}

same("the workflow keeps no second copy of the list", JSON.stringify(workflow).includes("git diff --quiet"), false)
const detections = []
for (const job of Object.values(workflow.jobs)) {
  for (const step of job.steps ?? []) {
    if (step.uses === "./.github/actions/pptx-changed") detections.push({ job, step })
  }
}
same("the pptx part and the changes job both read the one action", detections.length, 2)
same(
  "the pptx part's step keeps its id",
  detections.some(({ job, step }) => job === workflow.jobs.check && step.id === "pptx"),
  true,
)
const baseOf = "${{ github.event.pull_request.base.sha || github.event.merge_group.base_sha || github.event.before }}"
same(
  "both steps compare with the same base",
  detections.map(({ step }) => step.with.base),
  [baseOf, baseOf],
)

const changes = workflow.jobs.changes
same("the changes job runs only on pull requests", changes.if, "github.event_name == 'pull_request'")
same("the changes job hands out what the action found", changes.outputs, { pptx: "${{ steps.pptx.outputs.changed }}" })
same("the changes job reads the whole history for its base", changes.steps[0].with, { "fetch-depth": 0 })

const corpus = workflow.jobs.corpus
same("the corpus waits for the changes job", corpus.needs, "changes")
const corpusRuns = (event, changed) =>
  new Function(
    `return ${corpus.if
      .replace(/^\$\{\{\s*|\s*\}\}$/g, "")
      .replaceAll("!cancelled()", "true")
      .replaceAll("github.event_name", JSON.stringify(event))
      .replaceAll("needs.changes.outputs.pptx", JSON.stringify(changed))}`,
  )()
same(
  "a pull request that changes packages/pptx runs the corpus",
  corpusRuns("pull_request", changedAfter(["packages/pptx/src/write.ts"]).slice(8)),
  true,
)
same(
  "a docs-only pull request skips the corpus",
  corpusRuns("pull_request", changedAfter(["docs/notes.md"]).slice(8)),
  false,
)
same(
  "a pull request whose changes could not be read does not run the corpus here",
  corpusRuns("pull_request", ""),
  false,
)
same("the merge queue runs the corpus whatever changed", corpusRuns("merge_group", ""), true)
same("main runs the corpus whatever changed", corpusRuns("push", ""), true)

const verdict = workflow.jobs.ci.steps[1].run
const passes = (results) =>
  spawnSync("bash", [
    "-e",
    "-c",
    Object.entries(results).reduce(
      (text, [job, result]) => text.replaceAll(`\${{ needs.${job}.result }}`, result),
      verdict,
    ),
  ]).status === 0
same("ci needs the changes job", workflow.jobs.ci.needs.includes("changes"), true)
const base = { check: "success", corpus: "success", journeys: "success", changes: "success" }
same("ci passes when the corpus ran on a pull request", passes(base), true)
same("ci passes a docs-only pull request with the corpus skipped", passes({ ...base, corpus: "skipped" }), true)
same("ci passes in the queue with the changes job skipped", passes({ ...base, changes: "skipped" }), true)
same("ci fails when the changes job failed", passes({ ...base, changes: "failure", corpus: "skipped" }), false)
same("ci fails when the corpus failed on a pull request", passes({ ...base, corpus: "failure" }), false)
console.log("ci-pptx-changed: all assertions passed")
