import { browserSpec, deckStateNote } from "./deck-state-file.mjs"
import { plainLog } from "./failed-tests.mjs"

export const forceTheGap =
  "Prove the race by forcing the gap: put a delay where the two steps can interleave, so the old code fails every time, then show the fix passes 5 times in a row with the same delay."

const titleLimit = 256
const excerptLimit = 60
const failureHeader = /^\s*(?:\d+\) \S+\.spec\.\w+:\d+:\d+ › | FAIL\s)/
const excerptEnd = /^\s*\[\d+\/\d+\]|⎯{3,}|^\s+\d+ (?:failed|passed|flaky)/

export const designStatesFile = "tests/browser/design-states.spec.ts"
export const designStatesRunner = ".agents/skills/verify-airdesign/look/states.mjs"
export const designStateFile = (state) => `.agents/skills/verify-airdesign/look/states/${state}.mjs`
export const namedDesignState = (test) => test.file === designStatesFile && test.state !== undefined

export const testId = (test) => `${test.file}${test.line === undefined ? "" : `:${test.line}`} › ${test.name}`

export const raceTitle = (test) =>
  (namedDesignState(test) ? `Race: design-states › ${test.state}` : `Race: ${test.file} › ${test.name}`).slice(
    0,
    titleLimit,
  )

export const raceKey = (title) =>
  title
    .replace(/^((?:Race|Old fault): \S+?):\d+ › /, "$1 › ")
    .replace(/ \([^)]*\)$/, "")
    .slice(0, titleLimit - 10)

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

const deckState = (test) => (browserSpec(test.file) ? [deckStateNote, ""] : [])

const raceBody = ({ test, excerpt, commit, seen }) =>
  [
    `\`${testId(test)}\` failed ${seen}, at commit ${commit}.`,
    "",
    `A test that fails beside other work and passes on its own has found a race, in the test or in the code it covers. ${forceTheGap} Close this issue with the pull request that fixes the race. Each later failure of this test adds a comment here.`,
    "",
    ...deckState(test),
    ...output(excerpt),
  ].join("\n")

const raceComment = ({ test, excerpt, commit, seen }) =>
  [`Failed again ${seen}, at commit ${commit}.`, "", ...deckState(test), ...output(excerpt)].join("\n")

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

const closedRaceQuery = `query($search: String!) {
  search(query: $search, type: ISSUE, first: 100) {
    nodes {
      ... on Issue {
        number
        title
        url
        closedByPullRequestsReferences(first: 10, includeClosedPrs: true) {
          nodes { number state mergedAt mergeCommit { oid } }
        }
      }
    }
  }
}`

const closedSearch = (repository, test) =>
  namedDesignState(test)
    ? `repo:${repository} is:issue is:closed in:title "Race:" "design-states" "${test.state}"`
    : `repo:${repository} is:issue is:closed in:title "Race:" "${test.file}"`

export const fixesOf = ({ gh, repository, test }) => {
  const listed = gh([
    "api",
    "graphql",
    "-f",
    `query=${closedRaceQuery}`,
    "-f",
    `search=${closedSearch(repository, test)}`,
  ])
  if (listed.status !== 0) return { why: `the closed issues could not be read: ${said(listed)}` }
  try {
    const nodes = JSON.parse(listed.stdout).data.search.nodes
    const fixes = nodes
      .filter((issue) => issue.title !== undefined && raceKey(issue.title) === raceKey(raceTitle(test)))
      .flatMap((issue) =>
        (issue.closedByPullRequestsReferences?.nodes ?? [])
          .filter((pull) => pull.state === "MERGED" && pull.mergeCommit?.oid)
          .map((pull) => ({ issue, pull: pull.number, merge: pull.mergeCommit.oid, mergedAt: pull.mergedAt })),
      )
    return { fixes: fixes.sort((a, b) => b.mergedAt.localeCompare(a.mergedAt)) }
  } catch {
    return { why: "the closed issues could not be read: gh answered no JSON" }
  }
}

const hasFix = ({ gh, git, repository, commit, merge }) => {
  const local = git?.(["merge-base", "--is-ancestor", merge, commit])
  if (local?.status === 0) return { has: true }
  if (local?.status === 1) return { has: false }
  const compared = gh(["api", `repos/${repository}/compare/${merge}...${commit}`, "--jq", ".status"])
  if (compared.status !== 0)
    return { why: `could not tell whether ${commit} has the fix in ${merge}: ${said(compared)}` }
  return { has: ["ahead", "identical"].includes(compared.stdout.trim()) }
}

const predatesFixComment = ({ test, excerpt, commit, seen, fix }) =>
  [
    `Failed ${seen}, at commit ${commit}. That failure predates the fix: #${fix.pull} merged as ${fix.merge.slice(0, 7)}, and ${commit.slice(0, 7)} does not contain it. Nothing was filed.`,
    "",
    ...deckState(test),
    ...output(excerpt),
  ].join("\n")

const fixDidNotHoldComment = ({ test, excerpt, commit, seen, fix }) =>
  [
    `Failed ${seen}, at commit ${commit}, which contains the fix: #${fix.pull} merged as ${fix.merge.slice(0, 7)}. The fix did not hold, so this issue is open again.`,
    "",
    ...deckState(test),
    ...output(excerpt),
  ].join("\n")

const commentOn = ({ gh, repository, number, body, url }) => {
  const commented = gh(["issue", "comment", String(number), "--repo", repository, "--body-file", "-"], body)
  return commented.status === 0 ? { url } : { why: `gh issue comment failed: ${said(commented)}` }
}

const afterFix = ({ gh, git, repository, fix, test, excerpt, commit, seen }) => {
  const judged = hasFix({ gh, git, repository, commit, merge: fix.merge })
  if (judged.why !== undefined) return judged
  if (!judged.has) {
    return commentOn({
      gh,
      repository,
      number: fix.issue.number,
      url: fix.issue.url,
      body: predatesFixComment({ test, excerpt, commit, seen, fix }),
    })
  }
  const reopened = gh(["issue", "reopen", String(fix.issue.number), "--repo", repository])
  if (reopened.status !== 0) return { why: `gh issue reopen failed: ${said(reopened)}` }
  return commentOn({
    gh,
    repository,
    number: fix.issue.number,
    url: fix.issue.url,
    body: fixDidNotHoldComment({ test, excerpt, commit, seen, fix }),
  })
}

export const keepIssue = ({ gh, repository, title, body, comment, beforeCreate }) => {
  const issues = openIssues({ gh, repository })
  if (issues.why !== undefined) return issues
  const known = issues.open.find((issue) => raceKey(issue.title) === raceKey(title))
  if (known !== undefined) {
    const commented = gh(["issue", "comment", String(known.number), "--repo", repository, "--body-file", "-"], comment)
    return commented.status === 0 ? { url: known.url } : { why: `gh issue comment failed: ${said(commented)}` }
  }
  const earlier = beforeCreate?.()
  if (earlier !== undefined) return earlier
  const created = gh(["issue", "create", "--repo", repository, "--title", title, "--body-file", "-"], body)
  return created.status === 0
    ? { url: created.stdout.trim().split("\n").at(-1) }
    : { why: `gh issue create failed: ${said(created)}` }
}

const fixOfTest = ({ gh, git, repository, test, excerpt, commit, seen }) => {
  const closed = fixesOf({ gh, repository, test })
  if (closed.why !== undefined) return closed
  if (closed.fixes.length === 0) return undefined
  return afterFix({ gh, git, repository, fix: closed.fixes[0], test, excerpt, commit, seen })
}

export const recordRace = ({ gh, git, repository, test, excerpt, commit, seen }) =>
  keepIssue({
    gh,
    repository,
    title: raceTitle(test),
    body: raceBody({ test, excerpt, commit, seen }),
    comment: raceComment({ test, excerpt, commit, seen }),
    beforeCreate: () => fixOfTest({ gh, git, repository, test, excerpt, commit, seen }),
  })
