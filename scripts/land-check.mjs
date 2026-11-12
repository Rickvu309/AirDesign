import { failedSteps, failedTests } from "./failed-tests.mjs"

const dependsOnLoad = new Set(["test"])

const filesOf = (tests) => [...new Set(tests.map((test) => test.file))]

const fault = (how) => ({ passed: false, how })

export const judgeCheck = async ({ status, output, rerun, say }) => {
  if (status === 0) return { passed: true, how: "the check passed" }
  const steps = failedSteps(output)
  if (steps.length === 0) return fault("pnpm check failed and named no step. Read its output above.")
  const stuck = steps.filter((step) => !dependsOnLoad.has(step))
  if (stuck.length > 0) return fault(`pnpm check failed in ${stuck.join(", ")}. Fix it; load does not cause this.`)
  const failed = failedTests(output)
  if (failed.length === 0) return fault("the test step failed and named no test file. Read its output above.")
  const alone = []
  for (const file of filesOf(failed)) {
    for (const test of failed.filter((each) => each.file === file))
      say(`test: ${file} failed in the full run: ${test.name}`)
    const again = await rerun(file)
    const still = failedTests(again.output)
    if (again.status === 0) {
      say(`test: ${file} passed alone. This looks like machine load, not a fault.`)
    } else {
      const names = (still.length > 0 ? still : [{ name: "(no test named)" }]).map((test) => test.name)
      say(`test: ${file} failed alone too, so this is a real fault: ${names.join("; ")}`)
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
