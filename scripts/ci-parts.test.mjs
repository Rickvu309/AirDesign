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
  "the check job runs the source part and the browser tests in shards, the scripts and pdf parts, beside the design shards",
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
    "pdf",
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
same("ci waits for every part and journeys", workflow.jobs.ci.needs, ["check", "changes", "journeys"])
same(
  "the check jobs are the ones changes keeps",
  check.strategy.matrix.include,
  "${{ fromJSON(needs.changes.outputs.check) }}",
)

const partCheck = steps.filter((step) => (step.run ?? "").startsWith("pnpm check --part="))
same("one step runs pnpm check for a part", partCheck.length, 1)
same(
  "the pdf part does not run pnpm check, and other parts run only when needed",
  partCheck[0].if,
  "matrix.part != 'pdf' && steps.work.outputs.needed == 'true'",
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

const pdfCheck = steps.findIndex((step) => onlyOn(step, "pdf") && step.run === "pnpm check:pdf")
const pdfBuild = steps.findIndex((step) => onlyOn(step, "pdf") && step.run === "pnpm build:browser")
const poppler = steps.findIndex((step) => onlyOn(step, "pdf") && step.run?.includes("poppler-utils"))
same(
  "the PDF job installs Poppler and builds the app before inspecting the export",
  [poppler < pdfCheck, pdfBuild < pdfCheck, poppler >= 0, pdfBuild >= 0],
  [true, true, true, true],
)

const ciSteps = workflow.jobs.ci.steps

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
  steps.filter((step) => (step.run ?? "").includes("red-main.sh")).map((step) => step.if),
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
for (const [name, job] of [["check", check]]) {
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
          ["pdf", "", "", "true"],
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
}
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
  for (const part of ["design", "pdf"]) {
    for (const hit of ["true", "false"]) {
      for (const answer of ["123", ""]) {
        const passed = part === "pdf" && event === "push" && Boolean(answer)
        const needed = part === "design" ? event === "pull_request" : !passed
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
  "every pdf step respects the shared decision",
  steps.filter((step) => onlyOn(step, "pdf")).every((step) => step.if.includes("steps.work.outputs.needed == 'true'")),
  true,
)
if (failures > 0) process.exit(1)
console.log("ci-parts: all assertions passed")
