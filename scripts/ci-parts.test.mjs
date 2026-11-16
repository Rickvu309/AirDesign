import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const workflow = parse(fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8"))
const check = workflow.jobs.check
const steps = check.steps
const text = (step) => `${step.run ?? ""} ${step.uses ?? ""} ${JSON.stringify(step.with ?? {})}`
const onlyOn = (step, part) => (step.if ?? "").includes(`matrix.part == '${part}'`)

same("the check job runs three parts side by side", check.strategy.matrix.part, ["main", "side", "pptx"])
same("one failing part does not stop the others", check.strategy["fail-fast"], false)
same("ci waits for every part and the corpus", workflow.jobs.ci.needs, ["check", "corpus"])

const partCheck = steps.filter((step) => (step.run ?? "").startsWith("pnpm check --part="))
same("one step runs pnpm check for a part", partCheck.length, 1)
same(
  "the pptx part does not run pnpm check, and main does not run the side part again for a commit the merge queue passed",
  partCheck[0].if,
  "matrix.part != 'pptx' && steps.queued.outputs.passed != 'true'",
)

const queued = steps.find((step) => step.id === "queued")
same(
  "only the side part on main asks whether the merge queue passed the commit",
  queued?.if,
  "github.event_name == 'push' && matrix.part == 'side'",
)
same("the question comes before pnpm check", steps.indexOf(queued) < steps.indexOf(partCheck[0]), true)
same(
  "the question reads ci runs of the merge queue for this exact commit",
  [/head_sha=\$GITHUB_SHA/, /event=merge_group/, /status=success/, /ci\.yml/].map((pattern) =>
    pattern.test(queued.run),
  ),
  [true, true, true, true],
)
same("the question may read runs", workflow.permissions.actions, "read")

const pptxCheck = steps.filter((step) => step.run === "pnpm check:pptx")
same("one step runs the PowerPoint check", pptxCheck.length, 1)
same("the PowerPoint check runs in the pptx part", onlyOn(pptxCheck[0], "pptx"), true)
same(
  "the PowerPoint check runs only when its inputs changed",
  pptxCheck[0].if.includes("steps.pptx.outputs.changed != '0'"),
  true,
)

const pptxSteps = steps.filter((step) => /pptx/.test(`${step.id ?? ""} ${text(step)}`))
same(
  "no PowerPoint step waits behind the main part",
  pptxSteps.filter((step) => onlyOn(step, "main")).map((step) => step.id ?? step.run ?? step.uses),
  [],
)

const build = steps.findIndex((step) => onlyOn(step, "pptx") && /run build$/.test(step.run ?? ""))
same("the pptx part builds the packages before the PowerPoint check", build !== -1, true)
same("the build comes before the PowerPoint check", build < steps.indexOf(pptxCheck[0]), true)

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

const corpus = workflow.jobs.corpus
same(
  "the corpus job runs in the merge queue and ci waits for it",
  corpus.if,
  "github.event_name == 'push' || github.event_name == 'merge_group'",
)
const verdict = ciSteps[0].run
const passes = (check, corpusResult) =>
  spawnSync("bash", [
    "-e",
    "-c",
    verdict.replaceAll("${{ needs.check.result }}", check).replaceAll("${{ needs.corpus.result }}", corpusResult),
  ]).status === 0
same("ci passes when every part passed and the corpus passed", passes("success", "success"), true)
same("ci passes on a pull request, where the corpus is skipped", passes("success", "skipped"), true)
same("ci fails when the corpus failed", passes("success", "failure"), false)
same("ci fails when the corpus was cancelled", passes("success", "cancelled"), false)
same("ci fails when a part failed", passes("failure", "success"), false)
same(
  "only a failure on main opens the main is red issue",
  corpus.steps.filter((step) => (step.run ?? "").includes("red-main.sh")).map((step) => step.if),
  ["failure() && github.event_name == 'push'"],
)
