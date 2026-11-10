import { stages } from "./check.mjs"

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
  "sticks",
]
const stageOf = (name) => stages.findIndex((stage) => stage.some(([step]) => step === name))

const lostSteps = requiredSteps.filter((name) => stageOf(name) === -1)
if (lostSteps.length > 0) throw new Error(`check lost the step ${lostSteps.join(", ")}`)

for (const later of ["typecheck", "build"]) {
  if (stageOf("test") >= stageOf(later)) throw new Error(`check runs the unit tests no earlier than ${later}`)
}
