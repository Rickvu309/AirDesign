import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { parse } from "yaml"

const same = (name, actual, expected) => assert.deepEqual(actual, expected, name)
const corpus = parse(fs.readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")).jobs.corpus
const download = corpus.steps.find((step) => step.id === "validations")
const handoff = (mode, shard) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-ci-handoff-"))
  try {
    fs.writeFileSync(
      path.join(folder, "gh"),
      `#!/bin/bash
test "$1 $2 $3 $4 $5 $6" = "run download 123 -n corpus-validations-${shard} -D" || exit 9
test "$7" = "$HOME/.cache/airdesign/pptx-validations" || exit 9
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
for (const shard of [1, 2])
  same("each shard downloads its own answers", handoff("full", shard), { status: 0, output: "files=true" })
for (const mode of ["missing", "empty"]) {
  const result = handoff(mode, 2)
  same(`${mode} artifact does not enable a save`, result.output, "")
  same(`${mode} artifact stops before reporting files`, result.status, 1)
}
