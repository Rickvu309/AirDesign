import fs from "node:fs"
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
same("ci waits for every part", workflow.jobs.ci.needs, "check")

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
