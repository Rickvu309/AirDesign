import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { parse } from "yaml"

const same = (name, actual, expected) => assert.deepEqual(actual, expected, name)
const jobs = parse(fs.readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")).jobs
const handoff = (mode, shard) => {
  const download = (shard ? jobs.corpus : jobs.check).steps.find(
    (step) => step.id === (shard ? "validations" : "specs"),
  )
  const artifact = shard ? `corpus-validations-${shard}` : "spec-results"
  const directory = shard ? "pptx-validations" : "spec-results"
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-ci-handoff-"))
  try {
    fs.writeFileSync(
      path.join(folder, "gh"),
      `#!/bin/bash
test "$1 $2 $3 $4 $5 $6" = "run download 123 -n ${artifact} -D" || exit 9
test "$7" = "$HOME/.cache/airdesign/${directory}" || exit 9
[ "${mode}" != missing ] || exit 1
mkdir -p "$7"
[ "${mode}" != full ] || echo answer > "$7/answer.json"
`,
      { mode: 0o755 },
    )
    const output = path.join(folder, "output")
    const result = spawnSync(
      "bash",
      ["-e", "-o", "pipefail", "-c", download?.run.replaceAll("${{ matrix.shard }}", String(shard)) ?? "exit 9"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          HOME: folder,
          PATH: `${folder}:${process.env.PATH}`,
          RUN_ID: "123",
          GITHUB_OUTPUT: output,
        },
      },
    )
    return { status: result.status, output: fs.existsSync(output) ? fs.readFileSync(output, "utf8").trim() : "" }
  } finally {
    fs.rmSync(folder, { recursive: true, force: true })
  }
}
for (const shard of [1, 2, undefined])
  same("each artifact downloads to its own cache", handoff("full", shard), { status: 0, output: "files=true" })
for (const shard of [1, 2, undefined])
  for (const mode of ["missing", "empty"]) {
    const result = handoff(mode, shard)
    same(`${mode} artifact does not enable a save`, result.output, "")
    same(`${mode} artifact stops before reporting files`, result.status, 1)
  }

for (const job of [jobs.check, jobs.corpus]) {
  for (const step of job.steps.filter((step) => (step.uses ?? "").startsWith("actions/cache"))) {
    same("performance caches cannot fail certification", step["continue-on-error"], true)
  }
}
for (const [job, artifact, id] of [
  [jobs.corpus, "corpus-validations-${{ matrix.shard }}", "validations"],
  [jobs.check, "spec-results", "specs"],
]) {
  const upload = job.steps.find((step) => step.with?.name === artifact)
  const download = job.steps.find((step) => step.id === id)
  same("upload is optional", upload["continue-on-error"], true)
  same("upload is bounded", upload["timeout-minutes"], 2)
  same("download is optional", download["continue-on-error"], true)
  same("download is bounded", download["timeout-minutes"], 2)
  same("download requires approved proof", download.if.includes("steps.work.outputs.passed == 'true'"), true)
  same("download uses only the approved run", download.env.RUN_ID, "${{ steps.work.outputs.run-id }}")
}
console.log("ci-corpus: all assertions passed")
