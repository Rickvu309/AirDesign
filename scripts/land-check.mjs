import { checkSteps } from "./check-steps.mjs"
import { failedSteps, failedTests } from "./failed-tests.mjs"
import { failureExcerpt, forceTheGap } from "./race-issue.mjs"

const filesOf = (tests) => [...new Set(tests.map((test) => test.file))]

const fault = (how) => ({ passed: false, how })

const listed = (files) => files.join(", ")

export const judgeCheck = async ({ status, output, rerun, record, changed = [], say }) => {
  if (status === 0) return { passed: true, how: "the gate passed" }
  const steps = failedSteps(output)
  if (steps.length === 0) return fault("the gate failed and named no step. Read its output above.")
  const stuck = steps.filter((step) => !checkSteps.rerunsAlone(step))
  if (stuck.length > 0) return fault(`the gate failed in ${stuck.join(", ")}. Fix it, then run pnpm land again.`)
  const [step] = steps
  const failed = failedTests(output)
  if (failed.length === 0) return fault(`the ${step} step failed and named no test file. Read its output above.`)
  const faults = []
  const owned = []
  const recorded = []
  for (const file of filesOf(failed)) {
    const tests = failed.filter((each) => each.file === file)
    for (const test of tests) say(`${step}: ${file} failed in the gate: ${test.name}`)
    const again = await rerun(file)
    if (again.status !== 0) {
      const still = failedTests(again.output)
      const names = (still.length > 0 ? still : [{ name: "(no test named)" }]).map((test) => test.name)
      say(`${step}: ${file} failed alone too, so this is a fault: ${names.join("; ")}`)
      faults.push({ file, names })
      continue
    }
    if (changed.includes(file)) {
      say(`${step}: ${file} passed alone, so it has a race, and this branch changes it.`)
      owned.push(file)
      continue
    }
    const urls = []
    for (const test of tests) {
      const kept = await record({ test, excerpt: failureExcerpt(output, test) })
      if (kept.why !== undefined)
        return fault(
          `${file} failed in the gate and passed alone, so it has a race, and the race could not be recorded as an issue: ${kept.why}. Fix that, then run pnpm land again.`,
        )
      urls.push(kept.url)
    }
    say(
      `${step}: ${file} passed alone, so it has a race. This branch does not change it, so the race is recorded in ${listed([...new Set(urls)])} and the push goes on.`,
    )
    recorded.push(...urls)
  }
  if (faults.length > 0) {
    return fault(
      `these tests fail alone too: ${faults.map(({ file, names }) => `${file} (${names.join("; ")})`).join(", ")}. Fix them before the push.`,
    )
  }
  if (owned.length > 0) {
    return fault(
      `${listed(owned)} failed in the gate and passed alone, so this branch changes a test with a race. ${forceTheGap} Fix the race, not the test's wait, then run pnpm land again.`,
    )
  }
  return {
    passed: true,
    how: `every failed test file passed alone and is outside this branch; each race is recorded in ${listed([...new Set(recorded)])}`,
  }
}
