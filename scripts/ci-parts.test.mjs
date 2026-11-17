import { spawnSync } from "node:child_process"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

let failures = 0
const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++
    console.error(`FAIL ${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const workflow = parse(fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8"))
const check = workflow.jobs.check
const steps = check.steps
const text = (step) => `${step.run ?? ""} ${step.uses ?? ""} ${JSON.stringify(step.with ?? {})}`
const onlyOn = (step, part) => (step.if ?? "").includes(`matrix.part == '${part}'`)

const entries = check.strategy.matrix.include
same(
  "the check job runs the main part, the side part in three shards and the pptx part side by side",
  entries.map((entry) => [entry.part, entry.shard ?? ""].join(" ").trim()),
  ["main", "side 1/3", "side 2/3", "side 3/3", "pptx"],
)
same(
  "pnpm check gets the shard of its side part",
  steps.find((step) => (step.run ?? "").startsWith("pnpm check --part="))?.run,
  "pnpm check --part=${{ matrix.part }}${{ matrix.shard && format(' --shard={0}', matrix.shard) || '' }}",
)
same("each shard is a job of its own name", check.name.includes("matrix.shard"), true)
same(
  "each job keeps its failed test results under a name of its own",
  steps
    .find((step) => (step.uses ?? "").startsWith("actions/upload-artifact"))
    ?.with.name.includes("strategy.job-index"),
  true,
)
const firstShard = entries.find((entry) => entry.shard?.startsWith("1/")).shard
const listed = execFileSync(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", "--list", `--shard=${firstShard}`],
  { cwd: root, encoding: "utf8", env: { ...process.env, CI: "" } },
)
same(
  "the first shard, which runs design-findings, runs both design scans whose reports it judges",
  ["design-states.spec.ts", "every-screen.spec.ts"].map((file) => listed.includes(` ${file}:`)),
  [true, true],
)
same("one failing part does not stop the others", check.strategy["fail-fast"], false)
same("ci waits for every part, corpus, paint fidelity and journeys", workflow.jobs.ci.needs, [
  "check",
  "corpus",
  "paint-fidelity",
  "journeys",
])

const partCheck = steps.filter((step) => (step.run ?? "").startsWith("pnpm check --part="))
same("one step runs pnpm check for a part", partCheck.length, 1)
same(
  "the pptx part does not run pnpm check, and other parts run only when needed",
  partCheck[0].if,
  "matrix.part != 'pptx' && steps.work.outputs.needed == 'true'",
)

const queued = steps.find((step) => step.id === "work")
same("main and side ask whether the queue passed before setup", queued?.if, undefined)
same("the question uses the shared action", queued?.uses, "./.github/actions/queued")
same(
  "the question comes before setup",
  steps.indexOf(queued) < steps.findIndex((step) => (step.uses ?? "").startsWith("pnpm/action-setup")),
  true,
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
const passes = (check, corpusResult, journeysResult = "skipped", paintResult = "skipped") =>
  spawnSync("bash", [
    "-e",
    "-c",
    verdict
      .replaceAll("${{ needs.check.result }}", check)
      .replaceAll("${{ needs.corpus.result }}", corpusResult)
      .replaceAll("${{ needs.journeys.result }}", journeysResult)
      .replaceAll("${{ needs.paint-fidelity.result }}", paintResult),
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

const journeys = workflow.jobs.journeys
same(
  "journeys run on pull requests and in the merge queue",
  journeys.if,
  "github.event_name == 'pull_request' || github.event_name == 'merge_group'",
)
same("ci calls the reusable journeys workflow", journeys.uses, "./.github/workflows/journeys.yml")
same("ci passes when the journeys passed in the queue", passes("success", "success", "success"), true)
same("ci fails when a journey failed in the queue", passes("success", "success", "failure"), false)
same("ci fails when the journeys were cancelled", passes("success", "success", "cancelled"), false)
const journeysFile = parse(fs.readFileSync(path.join(root, ".github/workflows/journeys.yml"), "utf8"))
same("the journeys workflow can be called from ci", "workflow_call" in journeysFile.on, true)
same("journeys no longer run on push", "push" in journeysFile.on, false)
same("journeys keep manual dispatch", "workflow_dispatch" in journeysFile.on, true)
same(
  "journeys no longer open or close main issues",
  journeysFile.jobs.journeys.steps.some((step) => /red-main|gh issue/.test(step.run ?? "")),
  false,
)

const actionFile = path.join(root, ".github/actions/queued/action.yml")
const action = fs.existsSync(actionFile) ? parse(fs.readFileSync(actionFile, "utf8")) : undefined
const question = action?.runs.steps[0]
same(
  "the shared action exposes the queue run id",
  action?.outputs["run-id"]?.value,
  "${{ steps.queued.outputs.run-id }}",
)
same("the shared action exposes the decision", action?.outputs.needed?.value, "${{ steps.queued.outputs.needed }}")
same(
  "one shared question reads successful queue ci runs for this exact commit",
  [/head_sha=\$GITHUB_SHA/, /event=merge_group/, /status=success/, /ci\.yml/].map((pattern) =>
    pattern.test(question?.run ?? ""),
  ),
  [true, true, true, true],
)
same("the shared action exposes its answer", action?.outputs.passed.value, "${{ steps.queued.outputs.passed }}")
same(
  "shared decision receives its inputs",
  [question?.env.PART, question?.env.CACHE_HIT],
  ["${{ inputs.part }}", "${{ inputs.cache-hit }}"],
)
const execute = (run, env, answer = "true") => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-ci-work-"))
  try {
    fs.writeFileSync(
      path.join(folder, "gh"),
      `#!/bin/sh\n[ "$GH_FORBIDDEN" != 1 ] || exit 9\nprintf '%s\\n' '${answer}'\n`,
      { mode: 0o755 },
    )
    const output = path.join(folder, "output")
    const result = spawnSync("bash", ["-e", "-c", run], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${folder}:${process.env.PATH}`,
        GITHUB_OUTPUT: output,
        GITHUB_REPOSITORY: "a/b",
        GITHUB_SHA: "exact-sha",
        GITHUB_EVENT_NAME: "push",
        ...env,
      },
    })
    return { status: result.status, output: fs.existsSync(output) ? fs.readFileSync(output, "utf8").trim() : "" }
  } finally {
    fs.rmSync(folder, { recursive: true, force: true })
  }
}
for (const answer of ["123", ""]) {
  same(`queue answer ${answer} is exposed`, execute(question?.run ?? "exit 1", {}, answer), {
    status: 0,
    output: `passed=${Boolean(answer)}\nrun-id=${answer}\nneeded=true`,
  })
}
for (const [name, job] of [
  ["check", check],
  ["corpus", corpus],
  ["paint-fidelity", workflow.jobs["paint-fidelity"]],
]) {
  const found = job?.steps ?? []
  const work = found.find((step) => step.id === "work")
  const lookup = found.find((step) => step.id === "cache-lookup")
  const restore = found.find((step) => step.id === "work-cache")
  const save = found.find(
    (step) => (step.uses ?? "").startsWith("actions/cache/save") && step.with.path === lookup?.with.path,
  )
  same(`${name} looks up the exact cache without downloading`, lookup?.with["lookup-only"], true)
  same(
    `${name} looks up before setup`,
    found.indexOf(lookup) >= 0 &&
      found.indexOf(lookup) < found.findIndex((step) => (step.uses ?? "").startsWith("pnpm/action-setup")),
    true,
  )
  same(
    `${name} restores and saves the key it looked up`,
    [restore?.with.key, save?.with.key],
    [lookup?.with.key, lookup?.with.key],
  )
  same(`${name} decision reads exact hit and part`, work?.with, {
    "cache-hit": "${{ steps.cache-lookup.outputs.cache-hit }}",
    part: name === "check" ? "${{ matrix.part }}" : name,
  })
  for (const [part, passed, hit, needed] of [
    [name === "check" ? "main" : name, "true", "true", "false"],
    [name === "check" ? "main" : name, "true", "false", "true"],
    [name === "check" ? "main" : name, "false", "true", "true"],
    [name === "check" ? "main" : name, "", "true", "true"],
    ...(name === "check"
      ? [
          ["side", "true", "", "false"],
          ["pptx", "", "", "true"],
        ]
      : []),
  ]) {
    same(
      `${name} ${part} queue=${passed} exact-hit=${hit} needed=${needed}`,
      execute(question?.run ?? "exit 1", { PART: part, CACHE_HIT: hit }, passed === "true" ? "123" : ""),
      {
        status: 0,
        output: `passed=${passed === "true" && part !== "pptx"}\nrun-id=${passed === "true" && part !== "pptx" ? "123" : ""}\nneeded=${needed}`,
      },
    )
  }
  const expensive = found.filter(
    (step) =>
      /pnpm|postgres|actions\/tla|actions\/setup-node/.test(text(step)) &&
      step.id !== "cache-lookup" &&
      step.id !== "work-cache",
  )
  same(
    `${name} gates expensive setup and work`,
    expensive.length > 0 &&
      expensive.every((step) => onlyOn(step, "pptx") || step.if?.includes("steps.work.outputs.needed == 'true'")),
    true,
  )
  if (name !== "check") {
    same(`${name} uses the shared queue action on push`, work?.uses, "./.github/actions/queued")
    same(`${name} decides on every event`, work?.if, undefined)
    same(`${name} runs on queue and push`, job?.if, corpus.if)
    same(
      `${name} reports push failures`,
      found.filter((step) => (step.run ?? "").includes("red-main.sh")).map((step) => step.if),
      ["failure() && github.event_name == 'push'"],
    )
  }
}
const answers = corpus.steps.filter(
  (step) => step.with?.path === "~/.cache/airdesign/pptx-validations" && (step.uses ?? "").startsWith("actions/cache/"),
)
same(
  "validator prefix names the corpus and judge code",
  corpus.steps.find((step) => step.id === "answers")?.run,
  "echo \"prefix=pptx-validations-corpus-${{ hashFiles('scripts/pptx-judge/Program.cs', 'scripts/pptx-judge/PptxJudge.csproj') }}-\" >> \"$GITHUB_OUTPUT\"",
)
same(
  "validator restore accepts earlier runs of the same judge",
  answers[0]?.with["restore-keys"],
  "${{ steps.answers.outputs.prefix }}",
)
const corpusRun = corpus.steps.findIndex((step) => step.run === "pnpm check:pptx:corpus")
same(
  "the corpus restores the validator's saved answers before it runs and saves them after",
  answers.slice(0, 2).map((step) => [step.uses.split("@")[0], corpus.steps.indexOf(step) < corpusRun]),
  [
    ["actions/cache/restore", true],
    ["actions/cache/save", false],
  ],
)
same(
  "the corpus keeps its answers apart from the pptx part's and keys them by the validator's code",
  answers.slice(0, 2).map((step) => step.with.key),
  Array(2).fill("${{ steps.answers.outputs.prefix }}${{ github.run_id }}"),
)
same(
  "a queue run does not save answers, which no later run could read from its branch",
  answers[1]?.if,
  "steps.work.outputs.needed == 'true' && github.event_name != 'merge_group' && !cancelled()",
)

const upload = corpus.steps.find((step) => step.with?.name === "corpus-validations")
const download = corpus.steps.find((step) => step.id === "validations")
const handed = answers.find((step) => step.if === "steps.validations.outputs.files == 'true'")
same(
  "queue uploads only after the corpus succeeds",
  upload?.if,
  "github.event_name == 'merge_group' && steps.work.outputs.needed == 'true'",
)
same("upload follows corpus", corpus.steps.indexOf(upload) > corpusRun, true)
same(
  "queue artifact uses the pinned uploader",
  upload?.uses,
  steps.find((step) => (step.uses ?? "").startsWith("actions/upload-artifact"))?.uses,
)
same("queue artifact expires in one day", upload?.with["retention-days"], 1)
same("queue artifact holds validator answers", upload?.with.path, "~/.cache/airdesign/pptx-validations")
same(
  "push downloads only when work was skipped",
  download?.if,
  "github.event_name == 'push' && steps.work.outputs.needed == 'false'",
)
same("download uses the queue run id", download?.env.RUN_ID, "${{ steps.work.outputs.run-id }}")
same("download may read actions", download?.env.GH_TOKEN, "${{ github.token }}")
same(
  "handoff failures cannot fail main",
  [download, handed].map((step) => step?.["continue-on-error"]),
  [true, true],
)
same("handoff saves under the same validator key", handed?.with.key, answers[0]?.with.key)
same("handoff saves only after downloading", corpus.steps.indexOf(handed) > corpus.steps.indexOf(download), true)
const handoff = (mode) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-ci-handoff-"))
  try {
    fs.writeFileSync(
      path.join(folder, "gh"),
      `#!/bin/bash
test "$1 $2 $3 $4 $5 $6" = "run download 123 -n corpus-validations -D" || exit 9
test "$7" = "$HOME/.cache/airdesign/pptx-validations" || exit 9
[ "${mode}" != missing ] || exit 1
mkdir -p "$7"
[ "${mode}" != full ] || echo answer > "$7/answer.json"
`,
      { mode: 0o755 },
    )
    const output = path.join(folder, "output")
    const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", download?.run ?? "exit 9"], {
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: folder,
        PATH: `${folder}:${process.env.PATH}`,
        RUN_ID: "123",
        GITHUB_OUTPUT: output,
      },
    })
    return { status: result.status, output: fs.existsSync(output) ? fs.readFileSync(output, "utf8").trim() : "" }
  } finally {
    fs.rmSync(folder, { recursive: true, force: true })
  }
}
same("downloaded files enable the save", handoff("full"), { status: 0, output: "files=true" })
for (const mode of ["missing", "empty"]) {
  const result = handoff(mode)
  same(`${mode} artifact does not enable a save`, result.output, "")
  same(`${mode} artifact stops before reporting files`, result.status, 1)
}
for (const event of ["pull_request", "merge_group"]) {
  same(
    `${event} never skips work or queries queue runs`,
    execute(
      question?.run ?? "exit 9",
      { GITHUB_EVENT_NAME: event, PART: "side", CACHE_HIT: "true", GH_FORBIDDEN: "1" },
      "123",
    ),
    { status: 0, output: "passed=false\nrun-id=\nneeded=true" },
  )
}
const paint = workflow.jobs["paint-fidelity"]
same(
  "paint fidelity runs independently beside corpus",
  paint !== undefined &&
    paint.needs === undefined &&
    !corpus.steps.some((step) => step.run === "pnpm metric:paint-fidelity"),
  true,
)
same(
  "paint fidelity keeps its metric command",
  paint?.steps.some((step) => step.run === "pnpm metric:paint-fidelity"),
  true,
)
const cacheKey = (job) => job?.steps.find((step) => step.id === "renders")?.run
same(
  "paint and corpus look up the render key their job names once",
  [paint, corpus].map((job) => job?.steps.find((step) => step.id === "cache-lookup")?.with.key),
  Array(2).fill("${{ steps.renders.outputs.key }}"),
)
same(
  "paint and corpus save distinct cache keys",
  cacheKey(paint) !== undefined && cacheKey(paint) !== cacheKey(corpus),
  true,
)
for (const result of ["success", "skipped", "failure", "cancelled"]) {
  same(
    `ci judges paint fidelity ${result}`,
    passes("success", "success", "success", result),
    ["success", "skipped"].includes(result),
  )
}
if (failures > 0) process.exit(1)
console.log("ci-parts: all assertions passed")
