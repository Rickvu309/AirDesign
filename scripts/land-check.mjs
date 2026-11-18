import { checkSteps } from "./check-steps.mjs"
import { failedSteps, failedTests } from "./failed-tests.mjs"

const filesOf = (tests) => [...new Set(tests.map((test) => test.file))]

const fault = (how) => ({ passed: false, how })

export const judgeCheck = async ({ status, output, rerun, say }) => {
  if (status === 0) return { passed: true, how: "the gate passed" }
  const steps = failedSteps(output)
  if (steps.length === 0) return fault("the gate failed and named no step. Read its output above.")
  const stuck = steps.filter((step) => !checkSteps.rerunsAlone(step))
  if (stuck.length > 0) return fault(`the gate failed in ${stuck.join(", ")}. Fix it; load does not cause this.`)
  const [step] = steps
  const failed = failedTests(output)
  if (failed.length === 0) return fault(`the ${step} step failed and named no test file. Read its output above.`)
  const alone = []
  for (const file of filesOf(failed)) {
    for (const test of failed.filter((each) => each.file === file))
      say(`${step}: ${file} failed in the gate: ${test.name}`)
    const again = await rerun(file)
    const still = failedTests(again.output)
    if (again.status === 0) {
      say(`${step}: ${file} passed alone. This looks like machine load, not a fault.`)
    } else {
      const names = (still.length > 0 ? still : [{ name: "(no test named)" }]).map((test) => test.name)
      say(`${step}: ${file} failed alone too, so this is a real fault: ${names.join("; ")}`)
      alone.push({ file, names })
    }
  }
  if (alone.length > 0) {
    return fault(
      `these tests fail alone too: ${alone.map(({ file, names }) => `${file} (${names.join("; ")})`).join(", ")}. Fix them before the push.`,
    )
  }
  return { passed: true, how: `every failed test file passed alone: ${filesOf(failed).join(", ")}` }
}
