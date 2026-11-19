import { failedSteps, failedTests } from "./failed-tests.mjs"

const queueBase = (branch) => /^gh-readonly-queue\/main\/pr-\d+-([0-9a-f]{40})$/.exec(branch)?.[1]

const mainWhenRunStarted = ({ repository, run, gh, git }) => {
  if (run.event === "merge_group") {
    const base = queueBase(run.branch)
    if (base === undefined) return undefined
    if (
      git(["cat-file", "-e", `${base}^{commit}`]).status !== 0 &&
      git(["fetch", "--no-tags", "--no-write-fetch-head", "origin", base]).status !== 0
    )
      return undefined
    const shared = git(["merge-base", base, "origin/main"])
    return shared.status === 0 ? shared.stdout.trim() : undefined
  }
  const found = gh([
    "api",
    `repos/${repository}/commits?sha=main&until=${encodeURIComponent(run.createdAt)}&per_page=1`,
    "--jq",
    ".[0].sha",
  ])
  return found.status === 0 && found.stdout.trim() !== "" ? found.stdout.trim() : undefined
}

const snapshotLines = ({ repository, run, git, gh, files }) => {
  const then = mainWhenRunStarted({ repository, run, gh, git })
  const count = then ? git(["rev-list", "--count", `${then}..origin/main`]) : undefined
  if (count?.status !== 0 || !/^\d+$/.test(count.stdout.trim())) {
    return [
      "could not tell whether main has moved since this run started. Run git fetch origin main, then land --status.",
    ]
  }
  const behind = Number(count.stdout.trim())
  if (behind === 0)
    return [
      "main has not moved since this run started. A rerun would test the same snapshot: fix the test or the code.",
    ]
  const changed = new Set(
    git(["diff", "--name-only", then, "origin/main"])
      .stdout.split("\n")
      .filter((line) => line !== ""),
  )
  const moved = `main has moved ${behind} ${behind === 1 ? "commit" : "commits"} since this run started`
  if (files.length === 0)
    return [`${moved}. Rebase before you try again: git fetch origin main && git rebase origin/main && pnpm land`]
  return files.map((file) =>
    changed.has(file)
      ? `${moved}, and ${file} changed on main since. A fix may have landed. Do not rerun the job: git fetch origin main && git rebase origin/main && pnpm land`
      : `${moved}, but ${file} did not change on main. A rerun would test the same code: fix the test or the code.`,
  )
}

export const failedJobLogs = ({ repository, run, gh }) => {
  const jobs =
    run.attempt === undefined
      ? `repos/${repository}/actions/runs/${run.id}/jobs?per_page=100`
      : `repos/${repository}/actions/runs/${run.id}/attempts/${run.attempt}/jobs?per_page=100`
  return gh(["api", jobs, "--jq", '.jobs[] | select(.conclusion == "failure" and .name != "ci") | .id'])
    .stdout.split("\n")
    .filter((id) => id !== "")
    .map((id) => gh(["api", `repos/${repository}/actions/jobs/${id}/logs`]).stdout)
}

export const ciFailureLines = ({ repository, run, gh, git, logs = failedJobLogs({ repository, run, gh }) }) => {
  const steps = [...new Set(logs.flatMap(failedSteps))]
  const tests = failedTests(logs.join("\n"))
  const lines = [
    `ci run ${run.id} (${run.event}) failed in ${steps.length > 0 ? steps.join(", ") : "a step that left no name"}.`,
  ]
  for (const test of tests) {
    const where = test.line === undefined ? test.file : `${test.file}:${test.line}`
    lines.push(`  ${where}: ${test.name}`)
    if (test.error !== "") lines.push(`    ${test.error}`)
  }
  if (tests.length === 0)
    lines.push("  no failed test was named in the log. Read it with: gh run view " + run.id + " --log-failed")
  const artifacts = gh(["api", `repos/${repository}/actions/runs/${run.id}/artifacts`, "--jq", ".artifacts[].name"])
  for (const name of artifacts.stdout.split("\n").filter((line) => line.startsWith("test-results"))) {
    lines.push(`kept test results: ${name} (gh run download ${run.id} -n ${name})`)
  }
  const files = [...new Set(tests.map((test) => test.file))]
  return [...lines, ...snapshotLines({ repository, run, git, gh, files })]
}
