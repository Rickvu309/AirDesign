import { stages } from "./check.mjs"
import { partOf, sideSteps, stagesFor } from "./check.mjs"

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
