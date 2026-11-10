import { stages } from "./check.mjs"
import { partOf, sideSteps, stagesFor } from "./check.mjs"
import { judgedOnCi, mayPush } from "./check.mjs"
import { localSteps, onCi } from "./check.mjs"

const requiredSteps = [
  "format",
  "lint",
  "actionlint",
  "test",
  "tooling",
  "bug-rule",
  "specs",
  "browser",
  "site",
  "typecheck",
  "boundaries",
  "build",
  "metrics",
]
const stageOf = (name) => stages.findIndex((stage) => stage.some(([step]) => step === name))

const lostSteps = requiredSteps.filter((name) => stageOf(name) === -1)
if (lostSteps.length > 0) throw new Error(`check lost the step ${lostSteps.join(", ")}`)

for (const later of ["typecheck", "build"]) {
  if (stageOf("test") >= stageOf(later)) throw new Error(`check runs the unit tests no earlier than ${later}`)
}
if (stageOf("references") === -1) throw new Error("check lost the step references")

const namesIn = (part) => stagesFor(part).flatMap((stage) => stage.map(([name]) => name))
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
const mainStageOf = (name) => mainStages.findIndex((stage) => stage.some(([step]) => step === name))
for (const later of ["typecheck", "build", "metrics"]) {
  if (mainStageOf("test") >= mainStageOf(later))
    throw new Error(`the main part runs the unit tests no earlier than ${later}`)
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
const stepsWhen = (ci) => stagesFor("all", ci).flatMap((stage) => stage.map(([name]) => name))
for (const name of ["ratchet", "check-regression"]) {
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
