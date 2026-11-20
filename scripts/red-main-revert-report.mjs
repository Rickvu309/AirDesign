import { beforeAfterSection, hasBeforeAfter, noVisibleChange, seen } from "./before-after.mjs"
import { plainLog } from "./failed-tests.mjs"
import { agentHeader, failureExcerpt } from "./race-issue.mjs"
import { titleFaults } from "./title.mjs"

const runnerPath = /\/home\/runner\/work\/[^/\s]+\/[^/\s]+\//g
const excerptLimit = 2
export const runUrl = (repository, id) => `https://github.com/${repository}/actions/runs/${id}`
const short = (sha) => sha.slice(0, 7)
const checkProgress = /^(?:judge (?:break|valid|proof)|phase) /

const withoutProgress = (log) =>
  log
    .split("\n")
    .filter((line) => !checkProgress.test(plainLog(line)))
    .join("\n")

export const cleanRead = (read) => ({
  ...read,
  jobs: read.jobs.map((job) => ({ ...job, log: withoutProgress(job.log) })),
  logs: read.logs.map(withoutProgress),
})

const beforeAttachment = (excerpt) => {
  const kept = []
  for (const line of excerpt.split("\n")) {
    if (/^\s*attachment #/.test(line)) break
    kept.push(line)
  }
  while (kept.at(-1)?.trim() === "") kept.pop()
  return kept.join("\n")
}

const pullTitle = (target, title, drill) => {
  const quoted = `Revert "${title}"`
  return titleFaults(quoted).length === 0
    ? quoted
    : `Revert ${short(target)}${drill ? " for the red-main drill" : ", which turned main red"}`
}

const beforeAfter = ({ repository, named, culprit, changedFiles }) => {
  if (hasBeforeAfter(culprit, repository) && noVisibleChange(culprit) === undefined) {
    const images = (beforeAfterSection(culprit) ?? "")
      .split("\n")
      .filter((line) => /!\[[^\]]*\]\(https:\/\/github\.com\//.test(line))
    return ["## Before / after", "", `This puts back the before side of ${named}'s image:`, "", ...images, ""]
  }
  const unseen = noVisibleChange(culprit)
  if (unseen !== undefined)
    return ["## Before / after", "", `No visible change: this reverts ${named}, whose body says: ${unseen}`, ""]
  if (!changedFiles.some(seen)) return []
  return ["## Before / after", "", `This puts back what main showed before ${named}, whose body has no image.`, ""]
}

export const testExcerpt = (log, test) => beforeAttachment(failureExcerpt(log, test)).replace(runnerPath, "")

export const revertPull = ({
  repository,
  target,
  title,
  number,
  culprit = "",
  decision,
  failure,
  changedFiles,
  jobs,
  drill,
}) => {
  const named = number === undefined ? `commit \`${short(target)}\`` : `#${number}`
  const real = decision?.judged.at(-1) ?? { checks: [], tests: [] }
  const whys = [
    ...real.checks.map((check) => `${check} failed, and a failed check is never a race`),
    ...real.tests
      .filter((each) => each.verdict === "real")
      .map((each) => `${each.title.replace(/^Race: /, "")}: ${each.why}`),
  ]
  const log = jobs.map((job) => withoutProgress(job.log)).join("\n")
  const excerpts = real.tests
    .filter((each) => each.verdict === "real")
    .slice(0, excerptLimit)
    .flatMap((each) => ["~~~text", testExcerpt(log, each.test), "~~~", ""])
  const pullTitleText = pullTitle(target, title, drill)
  const summary = drill
    ? [
        `This reverts \`${short(target)}\`${number === undefined ? "" : ` from #${number}`} to verify the red-main bot can start ci and bar. The bot closes this pull request after both workflows start.`,
      ]
    : [
        `ci failed on main, and the first red commit is \`${short(target)}\` from ${named}, "${title}". This reverts it so main goes green again. The red-main bot merges this pull request once its ci passes while main is still red. It closes it instead if main goes green first, because someone fixed forward.`,
        "",
        `- First red run: ${runUrl(repository, decision.run.id)} at \`${short(decision.run.sha)}\``,
        `- Last green run: ${runUrl(repository, decision.green.id)} at \`${short(decision.green.sha)}\``,
      ]
  const evidence = drill
    ? [`[Drill workflow run](${runUrl(repository, drill.id)}) exercises a simulated red main.`, ""]
    : [
        `Failed jobs: ${jobs.map((job) => job.name).join(", ")}.`,
        "",
        "~~~text",
        ...failure.map((line) => line.replace(runnerPath, "")),
        "~~~",
        "",
        "Why this is not a race:",
        "",
        ...whys.map((why) => `- ${why}`),
        "",
        ...excerpts,
      ]
  const body = [
    agentHeader,
    "",
    ...(drill ? ["**Drill:** this pull request will be closed without merging.", ""] : []),
    "## Summary",
    "",
    ...summary,
    "",
    "## Evidence",
    "",
    ...evidence,
    ...(drill && !changedFiles.some(seen)
      ? ["## Before / after", "", "No visible change: the revert does not touch the app.", ""]
      : beforeAfter({ repository, named, culprit, changedFiles })),
    "## Merge Danger",
    "",
    drill
      ? "**Door:** two-way. Closing this pull request ends the drill."
      : `**Door:** two-way. ${named} lands again once it passes against this failure.`,
    "",
    drill
      ? "**Blast Radius:** the temporary branch and its checks."
      : `**Blast Radius:** what ${named} changed. It leaves main until it lands again.`,
    "",
  ].join("\n")
  const message = [
    pullTitleText,
    "",
    drill
      ? `This reverts commit ${target} for the red-main drill in ${runUrl(repository, drill.id)}.`
      : `This reverts commit ${target}, the first red commit on main in ci run ${runUrl(repository, decision.run.id)}.`,
    "",
    ...changedFiles.map((file) => `Reverts: ${file}`),
    "",
  ].join("\n")
  return { title: pullTitleText, body, message }
}
