import { failedScripts, failedSteps, failedTests, plainLog } from "./failed-tests.mjs"
import { raceKey, raceTitle } from "./race-issue.mjs"

const redConclusions = new Set(["failure", "timed_out", "startup_failure"])
const testSteps = new Set(["unit-tests", "script-tests", "browser-tests", "test", "tooling", "browser"])
const browserTest = /^tests\/(?:browser|journeys)\//
const pptxFailed = /^(\d+) pptx checks failed$/m

const jobFailures = (job) => {
  const plain = plainLog(job.log)
  const tests = [...failedTests(job.log), ...failedScripts(job.log)]
  const pptx = pptxFailed.exec(plain)
  if (pptx !== null) {
    const onlyTheSpec =
      Number(pptx[1]) === 1 && /^browser export spec failed/m.test(plain) && !/route writes failed/.test(plain)
    return onlyTheSpec && tests.length > 0
      ? { tests, checks: [] }
      : { tests, checks: [`${job.name}: ${pptx[1]} PowerPoint checks failed`] }
  }
  const steps = failedSteps(job.log)
  if (steps.length === 0)
    return tests.length > 0 ? { tests, checks: [] } : { tests, checks: [], unnamed: `${job.name} names no failed step` }
  const checks = steps.filter((step) => !testSteps.has(step)).map((step) => `${job.name}: step ${step}`)
  const bare = steps.filter((step) => testSteps.has(step))
  return bare.length > 0 && tests.length === 0
    ? { tests, checks, unnamed: `${job.name}: step ${bare.join(", ")} names no failed test` }
    : { tests, checks }
}

const testVerdict = ({ test, files, races, earlier }) => {
  const title = raceTitle(test)
  if (earlier.has(title))
    return { title, test, verdict: "real", repeated: true, why: "it failed in the red run before this one too" }
  if (races.has(raceKey(title))) return { title, test, verdict: "race", why: "an open issue already names this race" }
  if (files.includes(test.file))
    return { title, test, verdict: "real", why: `the commits it tests change ${test.file}` }
  if (browserTest.test(test.file))
    return {
      title,
      test,
      verdict: "suspect",
      why: `no commit it tests changes ${test.file}, so it reaches the test only through app code`,
    }
  return {
    title,
    test,
    verdict: "real",
    why: `${test.file} is a unit or script test, and no open Race: issue names it`,
  }
}

export const judgeRun = ({ jobs, warnings = [], files, races, earlier = new Set() }) => {
  if (jobs.length === 0)
    return { verdict: "unknown", why: warnings[0] ?? "no failed job was found", tests: [], checks: [] }
  const read = jobs.map(jobFailures)
  const raceKeys = new Set([...races].map(raceKey))
  const checks = read.flatMap((each) => each.checks)
  const seenTitles = new Set()
  const tests = read
    .flatMap((each) => each.tests)
    .filter((test) => !seenTitles.has(raceTitle(test)) && seenTitles.add(raceTitle(test)))
    .map((test) => testVerdict({ test, files, races: raceKeys, earlier }))
  const unnamed = [...read.flatMap((each) => each.unnamed ?? []), ...warnings]
  if (checks.length > 0 || tests.some((each) => each.verdict === "real")) return { verdict: "real", tests, checks }
  if (unnamed.length > 0) return { verdict: "unknown", why: unnamed[0], tests, checks }
  return { verdict: tests.some((each) => each.verdict === "suspect") ? "suspect" : "race", tests, checks }
}

const judgeStreak = ({ streak, green, jobsOf, filesBetween, races }) => {
  const firstSeen = new Map()
  const judged = []
  for (const [index, run] of streak.entries()) {
    if (!redConclusions.has(run.conclusion)) continue
    const before = index === 0 ? green : streak[index - 1]
    const judgment = judgeRun({
      ...jobsOf(run),
      files: filesBetween(before.sha, run.sha),
      races,
      earlier: new Set(firstSeen.keys()),
    })
    judged.push({ run, index, ...judgment })
    for (const each of judgment.tests) if (!firstSeen.has(each.title)) firstSeen.set(each.title, index)
  }
  return { judged, firstSeen }
}

const racesIn = (judged) => {
  const failed = judged.flatMap((each) => each.tests.map((test) => test.title))
  return judged
    .filter((each) => each.verdict === "suspect")
    .flatMap((each) =>
      each.tests
        .filter((test) => test.verdict === "suspect" && failed.filter((title) => title === test.title).length === 1)
        .map((test) => ({ run: each.run, ...test })),
    )
}

export const decide = ({ runs, commits, jobsOf, filesBetween, races }) => {
  const at = new Map(commits.map((sha, index) => [sha, index]))
  const latest = new Map()
  for (const run of runs.filter((each) => at.has(each.sha)))
    if ((latest.get(run.sha)?.id ?? -1) < run.id) latest.set(run.sha, run)
  const ordered = [...latest.values()].sort((left, right) => at.get(left.sha) - at.get(right.sha))
  const greenAt = ordered.findLastIndex((run) => run.conclusion === "success")
  if (greenAt === -1) return { action: "hold", why: "no ci run on main in reach passed", judged: [] }
  const green = ordered[greenAt]
  const streak = ordered.slice(greenAt + 1)
  const { judged, firstSeen } = judgeStreak({ streak, green, jobsOf, filesBetween, races })
  if (judged.length === 0) {
    const greenBefore = ordered.findLastIndex((run, index) => index < greenAt && run.conclusion === "success")
    const ended =
      greenBefore === -1
        ? []
        : judgeStreak({
            streak: ordered.slice(greenBefore + 1, greenAt),
            green: ordered[greenBefore],
            jobsOf,
            filesBetween,
            races,
          }).judged
    return { action: "green", green, judged, races: racesIn(ended) }
  }
  const real = judged.find((each) => each.verdict === "real")
  const suspect = judged.find((each) => each.verdict === "suspect")
  const deciding = real ?? suspect
  if (deciding === undefined) return { action: "hold", green, judged }
  const start = Math.min(
    deciding.index,
    ...deciding.tests.filter((each) => each.repeated).map((each) => firstSeen.get(each.title)),
  )
  const pending = streak.slice(0, start).find((each) => each.status !== "completed")
  if (pending !== undefined) return { action: "wait", run: pending, green, judged }
  const from = start === 0 ? green : streak[start - 1]
  return {
    action: real === undefined ? "suspect" : "revert",
    target: commits[at.get(from.sha) + 1],
    run: streak[start],
    green,
    judged,
    judgment: deciding,
  }
}
