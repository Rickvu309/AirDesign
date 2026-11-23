import { execFile, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { parse } from "yaml"
import { stepsOf } from "./check.mjs"
import { checkSteps, designScans, shardOf } from "./check-steps.mjs"

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

const checkJobsFile = workflow.jobs.changes.steps.find((step) => step.id === "map").with["check-jobs-file"]
const entries = JSON.parse(fs.readFileSync(path.join(root, checkJobsFile), "utf8"))
same(
  "the check job runs the source part and the browser tests in shards, the scripts and pptx parts, beside the design shards",
  entries.filter((entry) => entry.part !== "design").map((entry) => [entry.part, entry.shard ?? ""].join(" ").trim()),
  [
    "source",
    "source 1/2",
    "source 2/2",
    "scripts",
    "browser 1/8",
    "browser 2/8",
    "browser 3/8",
    "browser 4/8",
    "browser 5/8",
    "browser 6/8",
    "browser 7/8",
    "browser 8/8",
    "pptx",
  ],
)
same(
  "pnpm check gets the shard of its browser part",
  steps.find((step) => (step.run ?? "").startsWith("pnpm check --part="))?.run,
  "pnpm check --part=${{ matrix.part }}${{ matrix.shard && format(' --shard={0}', matrix.shard) || '' }}",
)
same("each shard is a job of its own name", check.name.includes("matrix.shard"), true)
same(
  "each job keeps its failed test results under a name of its own",
  steps.find((step) => step.with?.name?.startsWith("test-results-check"))?.with.name.includes("strategy.job-index"),
  true,
)
const listingWidth = 8
const listBrowserTests = async (args) =>
  (
    await promisify(execFile)(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--list", ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, CI: "" },
      maxBuffer: 64 * 2 ** 20,
    })
  ).stdout
    .split("\n")
    .filter((line) => line.includes(" › "))
    .map((line) => line.trim())
const listAll = async (argLists) => {
  const results = new Array(argLists.length)
  let next = 0
  const worker = async () => {
    while (next < argLists.length) {
      const at = next
      next += 1
      results[at] = await listBrowserTests(argLists[at])
    }
  }
  await Promise.all(Array.from({ length: Math.min(listingWidth, argLists.length) }, worker))
  return results
}
const browserStep = (part, shard) =>
  checkSteps
    .stagesFor(part, true, shard)
    .flat()
    .flatMap(stepsOf)
    .find(([name]) => name === "browser-tests")[2]
    .slice(1)
const shards = entries.filter((entry) => entry.part === "browser").map((entry) => shardOf([`--shard=${entry.shard}`]))
const [scanned, ...shardLists] = await listAll([
  browserStep("design"),
  ...shards.map((shard) => browserStep("browser", shard)),
])
const sharded = shardLists.flat()
const [everyTest] = await listAll([[]])
same(
  "the design part runs both design scans whose reports design-findings judges",
  designScans.map((file) => scanned.some((line) => line.includes(`${path.basename(file)}:`))),
  [true, true],
)
same(
  "the design part and the browser shards run every browser test exactly once",
  [...scanned, ...sharded].toSorted(),
  everyTest.toSorted(),
)
same("one failing part does not stop the others", check.strategy["fail-fast"], false)
same("ci waits for every part, corpus and journeys", workflow.jobs.ci.needs, ["check", "changes", "corpus", "journeys"])
same(
  "the check jobs are the ones changes keeps",
  check.strategy.matrix.include,
  "${{ fromJSON(needs.changes.outputs.check) }}",
)

const partCheck = steps.filter((step) => (step.run ?? "").startsWith("pnpm check --part="))
same("one step runs pnpm check for a part", partCheck.length, 1)
same(
  "the pptx part does not run pnpm check, and other parts run only when needed",
  partCheck[0].if,
  "matrix.part != 'pptx' && steps.work.outputs.needed == 'true'",
)

const queued = steps.find((step) => step.id === "work")
same("every part asks whether the queue passed before setup", queued?.if, undefined)
same("the question uses the shared action", queued?.uses, "./.github/actions/queued")
same(
  "the question comes before setup",
  steps.indexOf(queued) < steps.findIndex((step) => (step.uses ?? "").startsWith("pnpm/action-setup")),
  true,
)
same("the question may read runs", workflow.permissions.actions, "read")

const pptxCheck = steps.filter((step) => step.run === "pnpm check:pptx && pnpm check:pdf")
same("one step runs the PowerPoint check, then the PDF check", pptxCheck.length, 1)
same("the PowerPoint and PDF checks run in the pptx part", onlyOn(pptxCheck[0], "pptx"), true)
same(
  "the PowerPoint check is a check job of its own, which changes keeps only when its inputs changed",
  entries.filter((entry) => entry.part === "pptx"),
  [{ part: "pptx" }],
)

const pptxSteps = steps.filter((step) => /pptx/.test(`${step.id ?? ""} ${text(step)}`))
same(
  "no PowerPoint step waits behind the source part",
  pptxSteps.filter((step) => onlyOn(step, "source")).map((step) => step.id ?? step.run ?? step.uses),
  [],
)

const build = steps.findIndex((step) => onlyOn(step, "pptx") && /run build$/.test(step.run ?? ""))
same("the pptx part builds the packages before the PowerPoint check", build !== -1, true)
same("the build comes before the PowerPoint check", build < steps.indexOf(pptxCheck[0]), true)

const ciSteps = workflow.jobs.ci.steps

const corpus = workflow.jobs.corpus
same(
  "the corpus job runs unless changes said nothing it judges changed, and changes runs it in the merge queue and on main",
  corpus.if,
  "${{ !cancelled() && needs.changes.outputs.corpus != 'false' }}",
)
same("corpus uses two independent runners", corpus.strategy, { "fail-fast": false, matrix: { shard: [1, 2] } })
const rerunGuard = ciSteps[0]
const runsGuard = (attempt) =>
  spawnSync("bash", ["-e", "-c", rerunGuard.run], { encoding: "utf8", env: { ...process.env, RUN_ATTEMPT: attempt } })
same("the rerun guard reads the run attempt", rerunGuard.env, { RUN_ATTEMPT: "${{ github.run_attempt }}" })
same("a first attempt passes the rerun guard", runsGuard("1").status, 0)
same("a rerun fails the rerun guard", runsGuard("2").status, 1)
same(
  "a rerun is told to push a fix or run pnpm land again",
  runsGuard("2").stdout.includes("A failed ci run is never rerun. Push a fix, or run `pnpm land` again"),
  true,
)
same("a later rerun fails the rerun guard too", runsGuard("10").status, 1)
same("the rerun guard runs on every event and before every other ci step", workflow.jobs.ci.if, "${{ always() }}")
same("the verdict is the second ci step, after the rerun guard", ciSteps[1].env?.RESULTS, "${{ toJSON(needs) }}")
same(
  "only a failure on main opens the main is red issue",
  corpus.steps.filter((step) => (step.run ?? "").includes("red-main.sh")).map((step) => step.if),
  ["failure() && github.event_name == 'push'"],
)

const journeys = workflow.jobs.journeys
same(
  "journeys run on pull requests and in the merge queue, unless changes said nothing they walk changed",
  journeys.if,
  "${{ !cancelled() && github.event_name != 'push' && needs.changes.outputs.journeys != 'false' }}",
)
same("ci calls the reusable journeys workflow", journeys.uses, "./.github/workflows/journeys.yml")
const journeysFile = parse(fs.readFileSync(path.join(root, ".github/workflows/journeys.yml"), "utf8"))
same("the journeys workflow can be called from ci", "workflow_call" in journeysFile.on, true)
same("journeys no longer run on push", "push" in journeysFile.on, false)
same("journeys keep manual dispatch", "workflow_dispatch" in journeysFile.on, true)
same(
  "journeys no longer open or close main issues",
  journeysFile.jobs.journeys.steps.some((step) => /red-main|gh issue/.test(step.run ?? "")),
  false,
)

const action = parse(fs.readFileSync(path.join(root, ".github/actions/queued/action.yml"), "utf8"))
const question = action.runs.steps[0]
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
same("shared decision receives its inputs", [question?.env.PART], ["${{ inputs.part }}"])
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
        GITHUB_REF: "refs/heads/main",
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
]) {
  const found = job?.steps ?? []
  const work = found.find((step) => step.id === "work")
  const restore = found.find((step) => step.id === "work-cache")
  const save = found.find(
    (step) => (step.uses ?? "").startsWith("actions/cache/save") && step.with.path === restore?.with.path,
  )
  same(`${name} restores and saves the same performance cache`, restore?.with.key, save?.with.key)
  same(`${name} decision reads only the part`, work?.with, {
    part: name === "check" ? "${{ matrix.part }}" : name,
  })
  for (const [part, passed, hit, needed] of [
    [name === "check" ? "source" : name, "true", "true", "false"],
    [name === "check" ? "source" : name, "true", "false", "false"],
    [name === "check" ? "source" : name, "false", "true", "true"],
    [name === "check" ? "source" : name, "", "true", "true"],
    ...(name === "check"
      ? [
          ["scripts", "true", "", "false"],
          ["design", "true", "", "false"],
          ["design", "false", "", "false"],
          ["browser", "true", "", "false"],
          ["browser", "false", "", "true"],
          ["pptx", "", "", "true"],
        ]
      : []),
  ]) {
    same(
      `${name} ${part} queue=${passed} exact-hit=${hit} needed=${needed}`,
      execute(question?.run ?? "exit 1", { PART: part, CACHE_HIT: hit }, passed === "true" ? "123" : ""),
      {
        status: 0,
        output: `passed=${passed === "true" && part !== "design"}\nrun-id=${passed === "true" && part !== "design" ? "123" : ""}\nneeded=${needed}`,
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
    expensive.length > 0 && expensive.every((step) => step.if?.includes("steps.work.outputs.needed == 'true'")),
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
  "echo \"prefix=pptx-validations-corpus-${{ hashFiles('scripts/pptx-judge/Program.cs', 'scripts/pptx-judge/PptxJudge.csproj') }}-${{ matrix.shard }}-\" >> \"$GITHUB_OUTPUT\"",
)
same(
  "validator restore accepts earlier runs of the same judge",
  answers[0]?.with["restore-keys"],
  "${{ steps.answers.outputs.prefix }}",
)
const corpusRun = corpus.steps.findIndex((step) => step.run === "pnpm check:pptx:corpus --shard=${{ matrix.shard }}/2")
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
  Array(2).fill("${{ steps.answers.outputs.prefix }}${{ github.run_id }}-${{ github.run_attempt }}"),
)
same(
  "a queue run does not save answers, which no later run could read from its branch",
  answers[1]?.if,
  "steps.work.outputs.needed == 'true' && github.event_name != 'merge_group' && !cancelled()",
)

const upload = corpus.steps.find((step) => step.with?.name === "corpus-validations-${{ matrix.shard }}")
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
  steps.find((step) => step.with?.name?.startsWith("test-results-check"))?.uses,
)
same("queue artifact expires in one day", upload?.with["retention-days"], 1)
same("queue artifact holds validator answers", upload?.with.path, "~/.cache/airdesign/pptx-validations")
same(
  "push downloads answers whenever the exact queue run passed",
  download?.if,
  "github.event_name == 'push' && steps.work.outputs.passed == 'true'",
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
for (const event of ["pull_request", "merge_group"]) {
  same(
    `${event} never skips work or queries queue runs`,
    execute(
      question?.run ?? "exit 9",
      { GITHUB_EVENT_NAME: event, PART: "scripts", CACHE_HIT: "true", GH_FORBIDDEN: "1" },
      "123",
    ),
    { status: 0, output: "passed=false\nrun-id=\nneeded=true" },
  )
}
for (const event of ["pull_request", "merge_group", "push"]) {
  for (const part of ["design", "pptx"]) {
    for (const hit of ["true", "false"]) {
      for (const answer of ["123", ""]) {
        const passed = part === "pptx" && event === "push" && Boolean(answer)
        const needed = part === "design" ? event === "pull_request" : event !== "merge_group" && !passed
        same(
          `${event} ${part} hit=${hit} queue=${answer} needed=${needed}`,
          execute(
            question.run,
            {
              GITHUB_EVENT_NAME: event,
              PART: part,
              CACHE_HIT: hit,
              GH_FORBIDDEN: part === "design" || event !== "push" ? "1" : "",
            },
            answer,
          ),
          { status: 0, output: `passed=${passed}\nrun-id=${passed ? answer : ""}\nneeded=${needed}` },
        )
      }
    }
  }
}
same(
  "every pptx step respects the shared decision",
  steps.filter((step) => onlyOn(step, "pptx")).every((step) => step.if.includes("steps.work.outputs.needed == 'true'")),
  true,
)
same(
  "ci has no paint job or verdict",
  [workflow.jobs["paint-fidelity"], ciSteps[1].run.includes("paint-fidelity")],
  [undefined, false],
)
const paintPath = path.join(root, ".github/workflows/paint-fidelity.yml")
const paintFile = fs.existsSync(paintPath) ? parse(fs.readFileSync(paintPath, "utf8")) : {}
const paint = paintFile.jobs?.["paint-fidelity"]
const paintSteps = paint?.steps ?? []
same("paint runs on main and manual dispatch only", paintFile.on, {
  push: { branches: ["main"] },
  workflow_dispatch: null,
})
same(
  "paint never reuses a queue decision",
  paintSteps.some((step) => step.uses === "./.github/actions/queued" || /steps.work/.test(step.if ?? "")),
  false,
)
same(
  "paint always runs its metric with a 20 minute limit",
  paintSteps
    .filter((step) => step.run === "pnpm metric:paint-fidelity")
    .map((step) => [step.if, step["timeout-minutes"]]),
  [[undefined, 20]],
)
for (const cache of ["~/.cache/pptx-tools", "~/.cache/airdesign/pptx-renders"]) {
  same(
    `paint keeps ${cache}`,
    paintSteps.some((step) => step.with?.path === cache),
    true,
  )
}
same(
  "paint keeps Chromium through the shared Playwright action",
  paintSteps.some((step) => step.uses === "./.github/actions/playwright"),
  true,
)
same("paint reports a separate main issue", paintSteps.find((step) => (step.run ?? "").includes("red-main.sh"))?.env, {
  GH_TOKEN: "${{ github.token }}",
  RED_TITLE: "paint fidelity is red",
  RED_WHAT: "paint-fidelity",
})
same(
  "paint reports only failures on main",
  paintSteps.find((step) => (step.run ?? "").includes("red-main.sh"))?.if,
  "failure() && github.event_name == 'push'",
)
const deploy = parse(fs.readFileSync(path.join(root, ".github/workflows/deploy.yml"), "utf8"))
same("deploy waits only for ci", deploy.on.workflow_run.workflows, ["ci"])
const cacheKey = (job) => job?.steps.find((step) => step.id === "renders")?.run
same(
  "paint and corpus save distinct render keys",
  cacheKey(paint) !== undefined && cacheKey(paint) !== cacheKey(corpus),
  true,
)
const paintRestore = paintSteps.find((step) => step.id === "work-cache")
const paintSave = paintSteps.find((step) => (step.uses ?? "").startsWith("actions/cache/save"))
same(
  "paint restores and saves its render key",
  [paintRestore?.with.key, paintSave?.with.key],
  Array(2).fill("${{ steps.renders.outputs.key }}"),
)
if (failures > 0) process.exit(1)
console.log("ci-parts: all assertions passed")
