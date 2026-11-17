import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { parse } from "yaml"

const action = parse(fs.readFileSync(new URL("../.github/actions/queued/action.yml", import.meta.url), "utf8"))
const approved = {
  id: 123,
  head_sha: "exact-sha",
  event: "merge_group",
  status: "completed",
  conclusion: "success",
  path: ".github/workflows/ci.yml",
}
const execute = (runs, env = {}) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-queued-"))
  try {
    fs.writeFileSync(path.join(folder, "runs.json"), JSON.stringify({ workflow_runs: runs }))
    fs.writeFileSync(
      path.join(folder, "gh"),
      `#!/bin/bash
[ "$LOOKUP_FAIL" != 1 ] || exit 1
[ "$1" = api ] || exit 2
[ "$3" = --jq ] || exit 3
jq -r "$4" "${folder}/runs.json"
`,
      { mode: 0o755 },
    )
    const output = path.join(folder, "output")
    const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", action.runs.steps[0].run], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${folder}:${process.env.PATH}`,
        GITHUB_OUTPUT: output,
        GITHUB_REPOSITORY: "a/b",
        GITHUB_SHA: "exact-sha",
        GITHUB_REF: "refs/heads/main",
        GITHUB_EVENT_NAME: "push",
        ...env,
      },
    })
    assert.equal(result.status, 0, result.stderr)
    return fs.readFileSync(output, "utf8").trim()
  } finally {
    fs.rmSync(folder, { recursive: true, force: true })
  }
}
for (const part of ["main", "side", "browser", "corpus", "pptx"]) {
  for (const hit of ["true", "false"]) {
    const env = { PART: part, CACHE_HIT: hit }
    assert.equal(execute([approved], env), "passed=true\nrun-id=123\nneeded=false", `${part} cached=${hit}`)
    for (const runs of [
      [],
      [{ ...approved, head_sha: "other-sha" }],
      [{ ...approved, event: "pull_request" }],
      [{ ...approved, conclusion: "failure" }],
      [{ ...approved, status: "in_progress" }],
      [{ ...approved, path: ".github/workflows/other.yml" }],
    ]) {
      assert.equal(execute(runs, env), "passed=false\nrun-id=\nneeded=true")
    }
    assert.equal(execute([approved], { ...env, LOOKUP_FAIL: "1" }), "passed=false\nrun-id=\nneeded=true")
    assert.equal(execute([approved], { ...env, GITHUB_REF: "refs/heads/other" }), "passed=false\nrun-id=\nneeded=true")
  }
}
console.log("ci-queued: all assertions passed")
