import { readFileSync } from "node:fs"
import { stages } from "./check.mjs"
import { partOf, sideSteps, stagesFor } from "./check.mjs"
import { judgedOnCi, mayPush, stampable } from "./check.mjs"
import { localSteps, onCi, stepsOf } from "./check.mjs"
import { recordFailure, warnSteps } from "./check.mjs"
import { shardOf } from "./check.mjs"

const requiredSteps = [
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

const namesIn = (part) => stagesFor(part).flatMap(stepNames)
const everyStep = namesIn("all")
const split = [...namesIn("main"), ...namesIn("side")]
if (split.length !== everyStep.length || everyStep.some((name) => !split.includes(name))) {
  throw new Error("the main and side parts must run every step exactly once")
}
for (const name of sideSteps) {
  if (!everyStep.includes(name)) throw new Error(`the side part names ${name}, which check does not run`)
}
for (const name of ["test", "build", "metrics", "specs", "typecheck"]) {
  if (!namesIn("main").includes(name)) throw new Error(`the main part must run ${name}`)
}
const mainStages = stagesFor("main")
const mainStageOf = (name) => mainStages.findIndex((stage) => stepNames(stage).includes(name))
for (const earlier of ["test", "build"]) {
  if (mainStageOf(earlier) >= mainStageOf("metrics"))
    throw new Error(`the main part measures before ${earlier} finishes`)
}
if (partOf([]) !== "all" || partOf(["--part=side"]) !== "side" || partOf(["--part=main"]) !== "main") {
  throw new Error("--part does not choose its part")
}
let refused = ""
try {
  partOf(["--part=everything"])
} catch (error) {
  refused = error.message
}
if (refused !== "--part must be main or side, and it is everything.") throw new Error("an unknown part is not refused")
const stepsWhen = (ci) => stagesFor("all", ci).flatMap(stepNames)
for (const name of ["bar"]) {
  if (!localSteps.has(name)) throw new Error(`check does not run ${name} on this machine`)
  if (!stepsWhen(false).includes(name)) throw new Error(`a local check skips ${name}`)
  if (stepsWhen(true).includes(name)) throw new Error(`check runs ${name} on CI, where the real guard runs`)
}
if (stepsWhen(true).length + localSteps.size !== stepsWhen(false).length) {
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
  if (judgedOnCi.has(name) || mayPush([name], true))
    throw new Error(`${name} does not depend on load and must stop a push`)
  if (mayPush(["test", name], true)) throw new Error(`${name} failing next to test must still stop a push`)
}
if (mayPush([], false)) throw new Error("a check that stopped early saw too little to allow a push")

import { ciOnlySteps, stepsToRun } from "./check.mjs"

const ranWhen = (part, ci) => stepsToRun(stagesFor(part, ci), ci).flatMap(stepNames)
if (ranWhen("all", false).includes("browser")) throw new Error("a local check runs the browser tests")
if (!ranWhen("all", true).includes("browser")) throw new Error("ci lost the browser tests")
if (!ranWhen("side", true).includes("browser")) throw new Error("the side part on ci lost the browser tests")
if (!ciOnlySteps.has("browser")) throw new Error("the browser tests are not marked as ci only")
for (const name of everyStep.filter((step) => !ciOnlySteps.has(step))) {
  if (!ranWhen("all", false).includes(name)) throw new Error(`a local check skips ${name}`)
}
if (stepsToRun([[["browser"]], [["lint"]]], false).length !== 1) throw new Error("an emptied stage was kept")
const warned = new Set(["new-step"])
const warnFailed = []
if (recordFailure(warnFailed, "new-step", warned) !== "warn") throw new Error("a warn step does not print as a warning")
if (warnFailed.length !== 0) throw new Error("a warn step made check fail")
if (!mayPush(warnFailed, true)) throw new Error("a warn step stopped a push")
if (recordFailure(warnFailed, "lint", warned) !== "fail") throw new Error("a step outside warnSteps does not fail")
if (warnFailed.join() !== "lint" || mayPush(warnFailed, true)) throw new Error("a failing step must stop a push")
for (const name of warnSteps) {
  if (!everyStep.includes(name) && !localSteps.has(name))
    throw new Error(`warnSteps names ${name}, which check does not run`)
}
for (const name of [...requiredSteps, ...localSteps]) {
  if (warnSteps.has(name)) throw new Error(`${name} already blocks and cannot go back to warnSteps`)
}
if (!namesIn("main").includes("commit-authors")) throw new Error("the main part must run commit-authors")
if (!stepsWhen(true).includes("commit-authors")) throw new Error("ci must run commit-authors")
if (warnSteps.has("commit-authors")) throw new Error("commit-authors blocks from the start")

const sideStages = stagesFor("side", true)
const sideStageOf = (name) => sideStages.findIndex((stage) => stepNames(stage).includes(name))
if (sideStageOf("design-findings") <= sideStageOf("browser"))
  throw new Error("design-findings reads what the browser tests wrote, so it must run after them")
if (!ciOnlySteps.has("design-findings"))
  throw new Error("design-findings needs the browser tests, which run only on ci")

if (!stampable([], true)) throw new Error("a passing check must stamp the commit")
if (stampable(["test"], true)) {
  throw new Error("a failed test must not stamp the commit: only pnpm land stamps it, after the file passes alone")
}
if (stampable(["browser", "test"], true)) throw new Error("a failed test next to browser must not stamp the commit")
if (!stampable(["browser"], true)) throw new Error("the browser tests run on ci and must not stop a stamp")
if (stampable([], false)) throw new Error("a check that stopped early must not stamp the commit")
for (const name of ["conflict-markers", "migration-numbers", "commit-titles", "stale-tree", "spec-sync"]) {
  if (!everyStep.includes(name)) throw new Error(`check lost the step ${name}`)
  if (!warnSteps.has(name)) throw new Error(`${name} is new and starts in warnSteps`)
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
if (JSON.stringify(shardOf(["--part=side", "--shard=2/3"])) !== JSON.stringify({ current: 2, total: 3 }))
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
const shardSteps = (current) => stepsToRun(stagesFor("side", true, { current, total: 3 }), true).flat()
const browserOf = (current) =>
  shardSteps(current)
    .flatMap(stepsOf)
    .find(([name]) => name === "browser")
for (const current of [1, 2, 3]) {
  if (browserOf(current)?.[2].join(" ") !== `test:browser --shard=${current}/3`)
    throw new Error(`shard ${current} does not run its share of the browser tests`)
}
if (
  shardSteps(1)
    .flatMap(stepsOf)
    .map(([name]) => name)
    .sort()
    .join() !== [...sideSteps].sort().join()
)
  throw new Error("the first shard must run every side step")
for (const current of [2, 3]) {
  if (
    shardSteps(current)
      .flatMap(stepsOf)
      .map(([name]) => name)
      .join() !== "browser"
  )
    throw new Error(`shard ${current} must run only its share of the browser tests`)
}
if (
  stagesFor("side", true)
    .flat()
    .flatMap(stepsOf)
    .find(([name]) => name === "browser")?.[2]
    .join(" ") !== "test:browser"
)
  throw new Error("a check with no shard runs every browser test")
