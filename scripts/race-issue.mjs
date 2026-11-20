import { plainLog } from "./failed-tests.mjs"

export const agentHeader = "🤖 **AI Agent responding on behalf of Quan Vu**"

export const forceTheGap =
  "Prove the race by forcing the gap: put a delay where the two steps can interleave, so the old code fails every time, then show the fix passes 5 times in a row with the same delay."

const titleLimit = 256
const excerptLimit = 60
const failureHeader = /^\s*(?:\d+\) \S+\.spec\.\w+:\d+:\d+ › | FAIL\s)/
const excerptEnd = /^\s*\[\d+\/\d+\]|⎯{3,}|^\s+\d+ (?:failed|passed|flaky)/

export const testId = (test) => `${test.file}${test.line === undefined ? "" : `:${test.line}`} › ${test.name}`

export const raceTitle = (test) => `Race: ${test.file} › ${test.name}`.slice(0, titleLimit)

export const raceKey = (title) => title.replace(/^((?:Race|Old fault): \S+?):\d+ › /, "$1 › ").slice(0, titleLimit - 10)

const isHeaderOf = (line, test) =>
  failureHeader.test(line) &&
  line.includes(test.line === undefined ? test.file : `${test.file}:${test.line}:`) &&
  line.includes(test.name)

export const failureExcerpt = (log, test) => {
  const lines = plainLog(log).split("\n")
  const start = lines.findIndex((line) => isHeaderOf(line, test))
  if (start === -1) return test.error ?? ""
  const indent = lines[start].length - lines[start].trimStart().length
  const kept = [lines[start].trim()]
  for (const line of lines.slice(start + 1, start + excerptLimit)) {
    if (excerptEnd.test(line) || failureHeader.test(line)) break
    kept.push(line.slice(Math.min(indent, line.length - line.trimStart().length)).trimEnd())
  }
  while (kept.at(-1) === "") kept.pop()
  return kept.join("\n")
}

export const output = (excerpt) => ["~~~text", excerpt, "~~~"]

const raceBody = ({ test, excerpt, commit, seen }) =>
  [
    agentHeader,
    "",
    `\`${testId(test)}\` failed ${seen}, at commit ${commit}.`,
    "",
    `A test that fails beside other work and passes on its own has found a race, in the test or in the code it covers. ${forceTheGap} Close this issue with the pull request that fixes the race. Each later failure of this test adds a comment here.`,
    "",
    ...output(excerpt),
  ].join("\n")

const raceComment = ({ excerpt, commit, seen }) =>
  [agentHeader, "", `Failed again ${seen}, at commit ${commit}.`, "", ...output(excerpt)].join("\n")

const said = (answer) => (answer.stderr || answer.stdout).trim()

export const openIssues = ({ gh, repository }) => {
  const listed = gh([
    "issue",
    "list",
    "--repo",
    repository,
    "--state",
    "open",
    "--limit",
    "1000",
    "--json",
    "number,title,url",
  ])
  if (listed.status !== 0) return { why: `the open issues could not be read: ${said(listed)}` }
  try {
    return { open: JSON.parse(listed.stdout) }
  } catch {
    return { why: "the open issues could not be read: gh answered no JSON" }
  }
}

export const keepIssue = ({ gh, repository, title, body, comment }) => {
  const issues = openIssues({ gh, repository })
  if (issues.why !== undefined) return issues
  const known = issues.open.find((issue) => raceKey(issue.title) === raceKey(title))
  if (known !== undefined) {
    const commented = gh(["issue", "comment", String(known.number), "--repo", repository, "--body-file", "-"], comment)
    return commented.status === 0 ? { url: known.url } : { why: `gh issue comment failed: ${said(commented)}` }
  }
  const created = gh(["issue", "create", "--repo", repository, "--title", title, "--body-file", "-"], body)
  return created.status === 0
    ? { url: created.stdout.trim().split("\n").at(-1) }
    : { why: `gh issue create failed: ${said(created)}` }
}

export const recordRace = ({ gh, repository, test, excerpt, commit, seen }) =>
  keepIssue({
    gh,
    repository,
    title: raceTitle(test),
    body: raceBody({ test, excerpt, commit, seen }),
    comment: raceComment({ excerpt, commit, seen }),
  })
