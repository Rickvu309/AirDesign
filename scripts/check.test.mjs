import { spawn } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { runCheck, stepRunner, stepsOf } from "./check.mjs"
import { checkSteps, designScans, designShardOf, designShardVariable, onCi, partOf, shardOf } from "./check-steps.mjs"

const { isPreflight, mayPush, stagesFor, stampable, warns } = checkSteps
const stages = stagesFor("all", true)

const requiredSteps = [
  "unused-exports",
  "format",
  "lint",
  "actionlint",
  "unit-tests",
  "script-tests",
  "lint-rules",
  "file-growth",
  "model-check",
  "browser-tests",
  "site-build",
  "typecheck",
  "package-boundaries",
  "build",
  "metrics",
]
const stepNames = (stage) => stage.flatMap(stepsOf).map(([name]) => name)
const stageOf = (name) => stages.findIndex((stage) => stepNames(stage).includes(name))

const lostSteps = requiredSteps.filter((name) => stageOf(name) === -1)
if (lostSteps.length > 0) throw new Error(`check lost the step ${lostSteps.join(", ")}`)

const laneOf = (name) => stages.flat().find((entry) => stepsOf(entry).some(([step]) => step === name)) ?? []
const builders = laneOf("typecheck").map(([name]) => name)
for (const later of ["build", "site-build"]) {
  if (builders.indexOf(later) <= builders.indexOf("typecheck"))
    throw new Error(`${later} runs beside typecheck, and both write the same built output`)
}
if (stageOf("metrics") <= stageOf("build")) throw new Error("metrics reads the build before it is written")
if (stageOf("tsconfig-references") === -1) throw new Error("check lost the step tsconfig-references")

const namesIn = (part) => stagesFor(part, true).flatMap(stepNames)
const everyCiStep = namesIn("all")
const everyStep = [...new Set([...everyCiStep, ...stagesFor("all", false).flatMap(stepNames)])]
const split = [...namesIn("source"), ...namesIn("scripts"), ...namesIn("design"), ...namesIn("findings")].filter(
  (name, index, names) => name !== "test-imports" || names.indexOf(name) === index,
)
if (split.length !== everyCiStep.length || everyCiStep.some((name) => !split.includes(name))) {
  throw new Error("the source, scripts, design and findings parts must run every step exactly once")
}
for (const part of checkSteps.parts()) {
  for (const name of namesIn(part)) {
    if (!everyCiStep.includes(name)) throw new Error(`the ${part} part names ${name}, which check does not run`)
  }
}
if (namesIn("scripts").toSorted().join() !== "script-tests,site-build,test-imports")
  throw new Error("the scripts part must run test-imports, script-tests and site-build")
for (const name of ["unit-tests", "build", "metrics", "model-check", "typecheck"]) {
  if (!namesIn("source").includes(name)) throw new Error(`the source part must run ${name}`)
}
const sourceStages = stagesFor("source", true)
const sourceStageOf = (name) => sourceStages.findIndex((stage) => stepNames(stage).includes(name))
for (const earlier of ["unit-tests", "build"]) {
  if (sourceStageOf(earlier) >= sourceStageOf("metrics"))
    throw new Error(`the source part measures before ${earlier} finishes`)
}
if (
  partOf([]) !== "all" ||
  ["source", "scripts", "design", "browser", "findings"].some((part) => partOf([`--part=${part}`]) !== part)
) {
  throw new Error("--part does not choose its part")
}
let refused = ""
try {
  partOf(["--part=everything"])
} catch (error) {
  refused = error.message
}
if (refused !== "--part must be one of source, scripts, design, browser, findings, and it is everything.")
  throw new Error("an unknown part is not refused")
const stepsWhen = (ci) => stagesFor("all", ci).flatMap(stepNames)
if (!stepsWhen(false).includes("bar")) throw new Error("a local check skips bar")
if (stepsWhen(true).includes("bar")) throw new Error("check runs bar on CI, where the real guard runs")
if (
  stepsWhen(false)
    .filter((name) => !stepsWhen(true).includes(name))
    .join() !== "bar"
) {
  throw new Error("CI skips a step that is not a local guard")
}
if (!onCi({ CI: "true" }) || !onCi({ CI: "1" }) || onCi({}) || onCi({ CI: "false" })) {
  throw new Error("CI is not told apart from this machine")
}

if (!mayPush([], true)) throw new Error("a passing check may push")
if (!mayPush(["unit-tests"], true) || !mayPush(["browser-tests", "unit-tests"], true)) {
  throw new Error("a load timeout in unit-tests or browser-tests must leave the judgment to ci")
}
for (const name of [
  "format",
  "lint",
  "actionlint",
  "typecheck",
  "package-boundaries",
  "build",
  "script-tests",
  "lint-rules",
  "model-check",
]) {
  if (mayPush([name], true)) throw new Error(`${name} does not depend on load and must stop a push`)
  if (mayPush(["unit-tests", name], true)) throw new Error(`${name} failing next to unit-tests must still stop a push`)
}
if (mayPush([], false)) throw new Error("a check that stopped early saw too little to allow a push")

const ranWhen = (part, ci) => stagesFor(part, ci).flatMap(stepNames)
if (ranWhen("all", false).includes("browser-tests")) throw new Error("a local check runs the browser tests")
if (!ranWhen("all", true).includes("browser-tests")) throw new Error("ci lost the browser tests")
if (!ranWhen("browser", true).includes("browser-tests"))
  throw new Error("the browser part on ci lost the browser tests")
if (ranWhen("scripts", true).includes("browser-tests"))
  throw new Error("the scripts part runs browser tests beside the site build and the script tests")
for (const name of everyStep.filter((step) => !["browser-build", "browser-tests", "design-findings"].includes(step))) {
  if (!ranWhen("all", false).includes(name)) throw new Error(`a local check skips ${name}`)
}
if (stagesFor("design", false).length !== 1) throw new Error("an emptied stage was kept")
const warningResult = await runCheck({
  chosen: [[["spec-drift"]]],
  run: async () => 1,
  lock: async () => () => {},
})
if (warningResult.failed.length !== 0) throw new Error("a warn step made check fail")
if (!mayPush(warningResult.failed, warningResult.ranSteps)) throw new Error("a warn step stopped a push")
const blockingResult = await runCheck({
  chosen: [[["lint"]]],
  run: async () => 1,
  lock: async () => () => {},
})
if (blockingResult.failed.join() !== "lint" || mayPush(blockingResult.failed, blockingResult.ranSteps))
  throw new Error("a failing step must stop a push")
for (const name of [...requiredSteps, "bar"]) {
  if (warns(name)) throw new Error(`${name} already blocks and cannot go back to warning`)
}
if (!namesIn("source").includes("commit-authors")) throw new Error("the source part must run commit-authors")
if (!stepsWhen(true).includes("commit-authors")) throw new Error("ci must run commit-authors")
if (warns("commit-authors")) throw new Error("commit-authors blocks from the start")
if (!namesIn("source").includes("linear-branch")) throw new Error("the source part must run linear-branch")
if (!stepsWhen(true).includes("linear-branch")) throw new Error("ci must run linear-branch")
if (warns("linear-branch")) throw new Error("linear-branch blocks from the start")

if (ranWhen("design", true).includes("design-findings"))
  throw new Error("design-findings judges every design shard's report together, so no one design shard runs it")
if (ranWhen("findings", true).join() !== "test-imports,design-findings")
  throw new Error("the findings part judges the design reports and runs no browser test")
if (ranWhen("all", false).includes("design-findings"))
  throw new Error("design-findings needs the browser tests, which run only on ci")

if (!stampable([], true)) throw new Error("a passing check must stamp the commit")
if (stampable(["unit-tests"], true)) {
  throw new Error("a failed test must not stamp the commit: only pnpm land stamps it, after the file passes alone")
}
if (stampable(["browser-tests", "unit-tests"], true))
  throw new Error("a failed unit-tests step next to browser-tests must not stamp the commit")
if (!stampable(["browser-tests"], true)) throw new Error("the browser tests run on ci and must not stop a stamp")
if (stampable([], false)) throw new Error("a check that stopped early must not stamp the commit")
const warningSteps = [
  "conflict-markers",
  "migration-numbers",
  "commit-titles",
  "restored-files",
  "spec-drift",
  "spec-coverage",
  "design-findings",
]
for (const name of warningSteps) {
  if (!everyStep.includes(name)) throw new Error(`check lost the step ${name}`)
  if (!warns(name)) throw new Error(`${name} starts as a warning`)
}

const testStep = stages.flat().find(([name]) => name === "unit-tests")
const unitScript = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts["test:unit"]
if (
  unitScript !== "vitest run" ||
  testStep[1] !== "node" ||
  testStep[2].join(" ") !== "node_modules/vitest/vitest.mjs run"
) {
  throw new Error("the unit-tests step runs vitest itself, the command test:unit names, without pnpm starting first")
}

if (shardOf([]) !== undefined) throw new Error("a check with no --shard is not a shard")
if (JSON.stringify(shardOf(["--part=browser", "--shard=2/3"])) !== JSON.stringify({ current: 2, total: 3 }))
  throw new Error("--shard does not choose its shard")
for (const shard of ["0/3", "4/3", "2", "a/b", "1/0"]) {
  let shardRefused = ""
  try {
    shardOf([`--shard=${shard}`])
  } catch (error) {
    shardRefused = error.message
  }
  if (shardRefused !== `--shard must be a part of a whole, such as 1/3, and it is ${shard}.`)
    throw new Error(`--shard=${shard} is not refused`)
}
const browserStep = (part, shard) =>
  stagesFor(part, true, shard)
    .flat()
    .flatMap(stepsOf)
    .find(([name]) => name === "browser-tests")
const browserRun = (part, shard) => browserStep(part, shard)?.[2].join(" ")
const exceptDesignScans = "--grep-invert design-states\\.spec\\.ts|every-screen\\.spec\\.ts"
for (const current of [1, 2, 3]) {
  if (browserRun("browser", { current, total: 3 }) !== `test:browser ${exceptDesignScans} --shard=${current}/3`)
    throw new Error(`shard ${current} does not run its share of the browser tests outside the design scans`)
  if (ranWhen("browser", true).join() !== "test-imports,browser-build,browser-tests")
    throw new Error(`shard ${current} must run only its share of the browser tests`)
}
if (browserRun("design") !== `test:browser ${designScans.join(" ")}`)
  throw new Error("the design part must run the design scans and no other browser test")
if (ranWhen("design", true).join() !== "test-imports,browser-build,browser-tests")
  throw new Error("a design shard runs the design scans and leaves judging them to the findings part")
for (const current of [1, 2, 3]) {
  const step = browserStep("design", { current, total: 3 })
  if (step[2].join(" ") !== browserRun("design") || step[3]?.[designShardVariable] !== `${current}/3`)
    throw new Error(`design shard ${current} must run both design scans over its own share of the states`)
  if (JSON.stringify(designShardOf(step[3])) !== JSON.stringify({ current, total: 3 }))
    throw new Error(`the design scans do not read design shard ${current} from the step`)
}
if (browserStep("design")[3]?.[designShardVariable] !== undefined || designShardOf({}).total !== 1)
  throw new Error("a design part with no shard sweeps every state")
if (browserRun("all") !== "test:browser") throw new Error("a check with no part runs every browser test")

for (const name of [
  "format",
  "file-growth",
  "lint",
  "tsconfig-references",
  "lint-rules",
  "commit-authors",
  "linear-branch",
  "package-boundaries",
]) {
  if (!isPreflight(name) || !everyStep.includes(name)) throw new Error(`preflight lost ${name}`)
}
for (const name of ["unit-tests", "browser-tests", "build", "typecheck", "script-tests", "model-check"]) {
  if (isPreflight(name)) throw new Error(`${name} must wait for the machine`)
}
for (const fail of [undefined, "format", "lint", "file-growth"]) {
  const events = []
  const result = await runCheck({
    chosen: [[["format"], ["lint"], ["file-growth"], ["unit-tests"]]],
    run: async ([name]) => {
      events.push(name)
      return name === fail ? 1 : 0
    },
    lock: async () => {
      events.push("lock")
      return () => events.push("release")
    },
  })
  if (fail === undefined) {
    if (events.join() !== "format,lint,file-growth,lock,unit-tests,release")
      throw new Error(`wrong check order: ${events}`)
    if (!stampable(result.failed, result.ranSteps)) throw new Error("passing check cannot stamp")
  } else {
    if (events.includes("lock") || events.includes("unit-tests")) throw new Error(`${fail} waited for the machine`)
    if (stampable(result.failed, result.ranSteps)) throw new Error("preflight failure can stamp")
  }
}
const released = []
const recording = (events) => async () => (row) => events.push(row)
const failingFiles = new Set(["apps/web/src/a.test.ts", "packages/document/src/b.test.ts"])
await runCheck({
  chosen: [[["unit-tests"]]],
  tree: "ab12cd34",
  failedFiles: failingFiles,
  run: async () => 1,
  lock: recording(released),
})
await runCheck({ chosen: [[["unit-tests"]]], tree: "ab12cd34", run: async () => 0, lock: recording(released) })
await runCheck({ chosen: [[["unit-tests"]]], run: async () => 0, lock: recording(released) })
if (
  released[0].status !== "failed unit-tests" ||
  released[0].tree !== "ab12cd34" ||
  released[0].files !== "apps/web/src/a.test.ts packages/document/src/b.test.ts"
)
  throw new Error(`a failed check row lacks its tree or failing files: ${JSON.stringify(released[0])}`)
if (released[1].tree !== "ab12cd34" || released[1].files !== undefined)
  throw new Error(`a passed check row names failing files: ${JSON.stringify(released[1])}`)
if (released[2].tree !== undefined) throw new Error("a check with no tree wrote one")
const allEvents = []
await runCheck({
  chosen: [[["format"], ["unit-tests"]]],
  all: true,
  run: async ([name]) => {
    allEvents.push(name)
    return 1
  },
  lock: async () => {
    allEvents.push("lock")
    return () => allEvents.push("release")
  },
})
if (allEvents.join() !== "format,lock,unit-tests,release")
  throw new Error("--all must finish checks after preflight fails")

for (const eventName of [undefined, "", "pull_request", "push", "merge_group"]) {
  for (const name of everyStep) {
    const shouldWarn = warningSteps.includes(name) || (name === "file-growth" && eventName === "merge_group")
    const result = await runCheck({
      eventName,
      chosen: [[[name]]],
      run: async () => 1,
      lock: async () => () => {},
    })
    if (result.failed.join() !== (shouldWarn ? "" : name))
      throw new Error(`${name} must ${shouldWarn ? "warn" : "fail"} on ${eventName ?? "this machine"}`)
  }
  const printed = []
  const result = await runCheck({
    eventName,
    chosen: [
      [["file-growth", process.execPath, ["-e", 'console.error("deck.ts is over the limit"); process.exit(1)']]],
    ],
    run: stepRunner({ eventName, limitOf: () => undefined, say: (line) => printed.push(line) }),
    lock: async () => () => {},
  })
  const status = eventName === "merge_group" ? "warn" : "fail"
  if (!printed.join("").includes(`deck.ts is over the limit\n${status} file-growth `))
    throw new Error(`file-growth must print its diagnostic and ${status} on ${eventName}`)
  if (stampable(result.failed, result.ranSteps) !== (status === "warn"))
    throw new Error(`file-growth must allow check to finish only in the merge queue`)
}

const collected = new Set()
await stepRunner({ limitOf: () => undefined, say: () => {}, failedFiles: collected })([
  "unit-tests",
  process.execPath,
  ["-e", 'console.error(" FAIL  packages/document/src/a.test.ts > keeps order"); process.exit(1)'],
])
await stepRunner({ limitOf: () => undefined, say: () => {}, failedFiles: collected })([
  "unit-tests",
  process.execPath,
  ["-e", "process.exit(0)"],
])
if ([...collected].join() !== "packages/document/src/a.test.ts")
  throw new Error(`a failed step did not collect its failing test file: ${[...collected]}`)

const fakeBin = mkdtempSync(path.join(os.tmpdir(), "check-bin-"))
writeFileSync(path.join(fakeBin, "node"), "#!/bin/sh\nexit 0\n", { mode: 0o755 })
writeFileSync(
  path.join(fakeBin, "pnpm"),
  `#!/bin/sh\nyes "a long line a step prints before it fails" | head -c 400000\necho "end of pnpm $*"\nexit 1\n`,
  { mode: 0o755 },
)
const slowReader = await new Promise((resolve) => {
  const child = spawn(process.execPath, [fileURLToPath(new URL("./check.mjs", import.meta.url))], {
    env: { ...process.env, CI: "false", PATH: `${fakeBin}${path.delimiter}${process.env.PATH}` },
  })
  let stderr = ""
  child.stderr.pause()
  child.stderr.on("data", (chunk) => (stderr += chunk))
  setTimeout(() => child.stderr.resume(), 1000)
  child.on("close", (status) => resolve({ status, stderr }))
})
rmSync(fakeBin, { recursive: true, force: true })
if (slowReader.status !== 1) throw new Error(`a failed check must exit 1, and it exited ${slowReader.status}`)
if (!slowReader.stderr.includes("end of pnpm exec oxfmt --check"))
  throw new Error("a failed step's last line must reach a slow reader before check exits")
const lastLine = slowReader.stderr.trimEnd().split("\n").at(-1)
if (!lastLine.startsWith("failed: ") || !lastLine.includes("format"))
  throw new Error("check must end with the failed steps when its reader is slow")
