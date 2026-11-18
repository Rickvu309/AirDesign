import { readFileSync } from "node:fs"
import { runCheck, stepRunner, stepsOf } from "./check.mjs"
import { checkSteps, designScans, onCi, partOf, shardOf } from "./check-steps.mjs"

const { isPreflight, mayPush, stagesFor, stampable, warns } = checkSteps
const stages = stagesFor("all", true)

const requiredSteps = [
  "interface-width",
  "format",
  "lint",
  "actionlint",
  "test",
  "tooling",
  "bug-rule",
  "file-size",
  "specs",
  "browser",
  "site",
  "typecheck",
  "boundaries",
  "build",
  "metrics",
]
const stepNames = (stage) => stage.flatMap(stepsOf).map(([name]) => name)
const stageOf = (name) => stages.findIndex((stage) => stepNames(stage).includes(name))

const lostSteps = requiredSteps.filter((name) => stageOf(name) === -1)
if (lostSteps.length > 0) throw new Error(`check lost the step ${lostSteps.join(", ")}`)

const laneOf = (name) => stages.flat().find((entry) => stepsOf(entry).some(([step]) => step === name)) ?? []
const builders = laneOf("typecheck").map(([name]) => name)
for (const later of ["build", "site"]) {
  if (builders.indexOf(later) <= builders.indexOf("typecheck"))
    throw new Error(`${later} runs beside typecheck, and both write the same built output`)
}
if (stageOf("metrics") <= stageOf("build")) throw new Error("metrics reads the build before it is written")
if (stageOf("references") === -1) throw new Error("check lost the step references")

const namesIn = (part) => stagesFor(part, true).flatMap(stepNames)
const everyCiStep = namesIn("all")
const everyStep = [...new Set([...everyCiStep, ...stagesFor("all", false).flatMap(stepNames)])]
const split = [...namesIn("main"), ...namesIn("side"), ...namesIn("design")].filter(
  (name, index, names) => name !== "browser-imports" || names.indexOf(name) === index,
)
if (split.length !== everyCiStep.length || everyCiStep.some((name) => !split.includes(name))) {
  throw new Error("the main, side and design parts must run every step exactly once")
}
for (const part of checkSteps.parts()) {
  for (const name of namesIn(part)) {
    if (!everyCiStep.includes(name)) throw new Error(`the ${part} part names ${name}, which check does not run`)
  }
}
if (namesIn("side").toSorted().join() !== "browser-imports,site,tooling")
  throw new Error("the side part must run only the site build and the tooling tests")
for (const name of ["test", "build", "metrics", "specs", "typecheck"]) {
  if (!namesIn("main").includes(name)) throw new Error(`the main part must run ${name}`)
}
const mainStages = stagesFor("main", true)
const mainStageOf = (name) => mainStages.findIndex((stage) => stepNames(stage).includes(name))
for (const earlier of ["test", "build"]) {
  if (mainStageOf(earlier) >= mainStageOf("metrics"))
    throw new Error(`the main part measures before ${earlier} finishes`)
}
if (partOf([]) !== "all" || ["main", "side", "design", "browser"].some((part) => partOf([`--part=${part}`]) !== part)) {
  throw new Error("--part does not choose its part")
}
let refused = ""
try {
  partOf(["--part=everything"])
} catch (error) {
  refused = error.message
}
if (refused !== "--part must be one of main, side, design, browser, and it is everything.")
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
if (!mayPush(["test"], true) || !mayPush(["browser", "test"], true)) {
  throw new Error("a load timeout in test or browser must leave the judgment to ci")
}
for (const name of [
  "format",
  "lint",
  "actionlint",
  "typecheck",
  "boundaries",
  "build",
  "tooling",
  "bug-rule",
  "specs",
]) {
  if (mayPush([name], true)) throw new Error(`${name} does not depend on load and must stop a push`)
  if (mayPush(["test", name], true)) throw new Error(`${name} failing next to test must still stop a push`)
}
if (mayPush([], false)) throw new Error("a check that stopped early saw too little to allow a push")

const ranWhen = (part, ci) => stagesFor(part, ci).flatMap(stepNames)
if (ranWhen("all", false).includes("browser")) throw new Error("a local check runs the browser tests")
if (!ranWhen("all", true).includes("browser")) throw new Error("ci lost the browser tests")
if (!ranWhen("browser", true).includes("browser")) throw new Error("the browser part on ci lost the browser tests")
if (ranWhen("side", true).includes("browser"))
  throw new Error("the side part runs browser tests beside the site build and the tooling tests")
for (const name of everyStep.filter((step) => step !== "browser" && step !== "design-findings")) {
  if (!ranWhen("all", false).includes(name)) throw new Error(`a local check skips ${name}`)
}
if (stagesFor("design", false).length !== 1) throw new Error("an emptied stage was kept")
const warningResult = await runCheck({
  chosen: [[["spec-sync"]]],
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
if (!namesIn("main").includes("commit-authors")) throw new Error("the main part must run commit-authors")
if (!stepsWhen(true).includes("commit-authors")) throw new Error("ci must run commit-authors")
if (warns("commit-authors")) throw new Error("commit-authors blocks from the start")

const designStages = stagesFor("design", true)
const designStageOf = (name) => designStages.findIndex((stage) => stepNames(stage).includes(name))
if (designStageOf("design-findings") <= designStageOf("browser"))
  throw new Error("design-findings reads what the browser tests wrote, so it must run after them")
if (ranWhen("all", false).includes("design-findings"))
  throw new Error("design-findings needs the browser tests, which run only on ci")

if (!stampable([], true)) throw new Error("a passing check must stamp the commit")
if (stampable(["test"], true)) {
  throw new Error("a failed test must not stamp the commit: only pnpm land stamps it, after the file passes alone")
}
if (stampable(["browser", "test"], true)) throw new Error("a failed test next to browser must not stamp the commit")
if (!stampable(["browser"], true)) throw new Error("the browser tests run on ci and must not stop a stamp")
if (stampable([], false)) throw new Error("a check that stopped early must not stamp the commit")
const warningSteps = [
  "conflict-markers",
  "migration-numbers",
  "commit-titles",
  "stale-tree",
  "spec-sync",
  "spec-replays",
  "design-findings",
]
for (const name of warningSteps) {
  if (!everyStep.includes(name)) throw new Error(`check lost the step ${name}`)
  if (!warns(name)) throw new Error(`${name} starts as a warning`)
}

const testStep = stages.flat().find(([name]) => name === "test")
const unitScript = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts["test:unit"]
if (
  unitScript !== "vitest run" ||
  testStep[1] !== "node" ||
  testStep[2].join(" ") !== "node_modules/vitest/vitest.mjs run"
) {
  throw new Error("the test step runs vitest itself, the command test:unit names, without pnpm starting first")
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
const browserRun = (part, shard) =>
  stagesFor(part, true, shard)
    .flat()
    .flatMap(stepsOf)
    .find(([name]) => name === "browser")?.[2]
    .join(" ")
const exceptDesignScans = "--grep-invert design-states\\.spec\\.ts|every-screen\\.spec\\.ts"
for (const current of [1, 2, 3]) {
  if (browserRun("browser", { current, total: 3 }) !== `test:browser ${exceptDesignScans} --shard=${current}/3`)
    throw new Error(`shard ${current} does not run its share of the browser tests outside the design scans`)
  if (ranWhen("browser", true).join() !== "browser-imports,browser")
    throw new Error(`shard ${current} must run only its share of the browser tests`)
}
if (browserRun("design") !== `test:browser ${designScans.join(" ")}`)
  throw new Error("the design part must run the design scans and no other browser test")
if (ranWhen("design", true).join() !== "browser-imports,browser,design-findings")
  throw new Error("the design part must run the design scans and then judge their findings")
if (browserRun("design", { current: 2, total: 3 }) !== browserRun("design"))
  throw new Error("a shard must not split the design scans, which design-findings reads together")
if (browserRun("all") !== "test:browser") throw new Error("a check with no part runs every browser test")

for (const name of ["format", "file-size", "lint", "references", "bug-rule", "commit-authors", "boundaries"]) {
  if (!isPreflight(name) || !everyStep.includes(name)) throw new Error(`preflight lost ${name}`)
}
for (const name of ["test", "browser", "build", "typecheck", "tooling", "specs"]) {
  if (isPreflight(name)) throw new Error(`${name} must wait for the machine`)
}
for (const fail of [undefined, "format", "lint", "file-size"]) {
  const events = []
  const result = await runCheck({
    chosen: [[["format"], ["lint"], ["file-size"], ["test"]]],
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
    if (events.join() !== "format,lint,file-size,lock,test,release") throw new Error(`wrong check order: ${events}`)
    if (!stampable(result.failed, result.ranSteps)) throw new Error("passing check cannot stamp")
  } else {
    if (events.includes("lock") || events.includes("test")) throw new Error(`${fail} waited for the machine`)
    if (stampable(result.failed, result.ranSteps)) throw new Error("preflight failure can stamp")
  }
}
const allEvents = []
await runCheck({
  chosen: [[["format"], ["test"]]],
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
if (allEvents.join() !== "format,lock,test,release") throw new Error("--all must finish checks after preflight fails")

for (const eventName of [undefined, "", "pull_request", "push", "merge_group"]) {
  for (const name of everyStep) {
    const shouldWarn = warningSteps.includes(name) || (name === "file-size" && eventName === "merge_group")
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
    chosen: [[["file-size", process.execPath, ["-e", 'console.error("deck.ts is over the limit"); process.exit(1)']]]],
    run: stepRunner({ eventName, limitOf: () => undefined, say: (line) => printed.push(line) }),
    lock: async () => () => {},
  })
  const status = eventName === "merge_group" ? "warn" : "fail"
  if (!printed.join("").includes(`deck.ts is over the limit\n${status} file-size `))
    throw new Error(`file-size must print its diagnostic and ${status} on ${eventName}`)
  if (stampable(result.failed, result.ranSteps) !== (status === "warn"))
    throw new Error(`file-size must allow check to finish only in the merge queue`)
}
