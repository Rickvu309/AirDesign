import { replayVariable } from "./property-seed.mjs"
import { agentHeader, keepIssue, output, testId } from "./race-issue.mjs"

const titleLimit = 256

export const oldFaultTitle = (test) => `Old fault: ${test.file} › ${test.name}`.slice(0, titleLimit)

const quoted = (text) => `'${text.replaceAll("'", "'\\''")}'`

export const rerunLine = (test) =>
  [
    ...(test.replay === undefined ? [] : [`${replayVariable}=${quoted(JSON.stringify(test.replay))}`]),
    "pnpm exec vitest run",
    test.file,
    ...(test.name === "(the whole file)" ? [] : ["-t", quoted(test.name.split(" > ").join(" "))]),
  ].join(" ")

const how = (test) => (test.replay === undefined ? "" : " with the same seed and path")

const oldFaultBody = ({ test, excerpt, commit, green, seen }) =>
  [
    agentHeader,
    "",
    `\`${testId(test)}\` failed ${seen}, at commit ${commit}. The bot ran it again at the last green commit ${green}${how(test)}, and it failed the same way there, so no commit after ${green} caused it. The bot reverted nothing for it.`,
    "",
    "Run it again on your machine:",
    "",
    "~~~sh",
    rerunLine(test),
    "~~~",
    "",
    "Close this issue with the pull request that fixes the fault and keeps this input as a test. Each later failure of this test that also fails at its last green commit adds a comment here.",
    "",
    ...output(excerpt),
  ].join("\n")

const oldFaultComment = ({ test, excerpt, commit, green, seen }) =>
  [
    agentHeader,
    "",
    `Failed again ${seen}, at commit ${commit}, and the same way at the last green commit ${green}${how(test)}.`,
    "",
    "~~~sh",
    rerunLine(test),
    "~~~",
    "",
    ...output(excerpt),
  ].join("\n")

export const recordOldFault = ({ gh, repository, test, excerpt, commit, green, seen }) =>
  keepIssue({
    gh,
    repository,
    title: oldFaultTitle(test),
    body: oldFaultBody({ test, excerpt, commit, green, seen }),
    comment: oldFaultComment({ test, excerpt, commit, green, seen }),
  })
