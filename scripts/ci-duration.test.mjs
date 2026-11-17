import { spawnSync } from "node:child_process"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { parse } from "yaml"

const same = (name, actual, expected) => assert.deepEqual(actual, expected, name)
const workflow = parse(fs.readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"))
const ciSteps = workflow.jobs.ci.steps
const timing = ciSteps.find((step) => step.name === "ci-duration")
same("the ci job times the merge queue's run", timing?.if, "github.event_name == 'merge_group'")
same("ci-duration is timed after ci passed", ciSteps.indexOf(timing) > 0, true)
same("a slow or unread ci-duration warns and never fails ci", timing["continue-on-error"], true)

const timed = (minutesAgo, limit) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-ci-duration-"))
  try {
    const created = new Date(Date.now() - minutesAgo * 60_000).toISOString()
    fs.writeFileSync(
      path.join(folder, "gh"),
      `#!/bin/sh\ncase "$*" in\n*createdAt*) echo "${created}" ;;\n*metrics.json*) echo ${limit} ;;\nesac\n`,
      { mode: 0o755 },
    )
    const summary = path.join(folder, "summary.md")
    const result = spawnSync("bash", ["-e", "-c", timing.run], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${folder}:${process.env.PATH}`,
        GITHUB_STEP_SUMMARY: summary,
        GITHUB_RUN_ID: "1",
        GITHUB_REPOSITORY: "a/b",
        GITHUB_SHA: "c",
      },
    })
    return { status: result.status, out: result.stdout, summary: fs.readFileSync(summary, "utf8") }
  } finally {
    fs.rmSync(folder, { recursive: true, force: true })
  }
}

const quick = timed(12, 40)
same("a quick queue run prints its minutes", /^metric ci-duration {2}now 12\.0 {2}limit 40$/m.test(quick.out), true)
same("the minutes go to the job summary", quick.summary.includes("metric ci-duration  now 12.0  limit 40"), true)
same("a quick queue run does not warn", quick.out.includes("::warning"), false)
const slow = timed(50, 40)
same("a slow queue run passes its step", slow.status, 0)
same(
  "a slow queue run warns with both numbers",
  slow.out.includes("::warning title=ci-duration::ci-duration is 50.0 and its limit is 40."),
  true,
)
