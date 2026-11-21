import { recordOldFault } from "./old-fault-issue.mjs"
import { agentHeader, recordRace } from "./race-issue.mjs"
import { runUrl, testExcerpt } from "./red-main-revert-report.mjs"

const short = (sha) => sha.slice(0, 7)

const logOf = (io, run) =>
  io
    .jobsOf(run)
    .jobs.map((job) => job.log)
    .join("\n")

const keep = ({ repository, io, each, log, event }) => {
  const seen = `on main in ci run ${runUrl(repository, event.id)}`
  const excerpt = testExcerpt(log, each.test)
  return each.verdict === "old"
    ? recordOldFault({ gh: io.gh, repository, test: each.test, excerpt, commit: event.sha, green: each.rerun.at, seen })
    : recordRace({
        gh: io.gh,
        repository,
        test: each.test,
        excerpt,
        commit: event.sha,
        seen: `${seen}, where ${each.why}`,
      })
}

const listed = (urls) => [...new Set(urls)].join(", ")

const recordedLine = ({ repository, event, races, old, suspect }) => {
  const parts = [
    ...(races.length === 0 ? [] : [`races, recorded in ${listed(races)}`]),
    ...(old.length === 0
      ? []
      : [`old faults that fail the same way at the last green commit too, recorded in ${listed(old)}`]),
  ]
  const head = `${agentHeader}\n\nci failed on main in run ${runUrl(repository, event.id)}`
  return suspect
    ? `${head} on ${parts.join(" and ")}. The bot reverts nothing for them.`
    : `${head} only on ${parts.join(" and ")}. The bot reverts nothing. The next push to main runs ci again.`
}

export const recordRun = ({ repository, io, judged, event, ended = false }) => {
  if (judged === undefined) return { failed: false }
  if (judged.verdict === "unknown") {
    io.redMain(
      `${agentHeader}\n\nci failed on main in run ${runUrl(repository, event.id)}, and the bot reverts nothing: ${judged.why}. A person or agent reads the log.`,
      ended,
    )
    return { failed: false }
  }
  const suspect = judged.verdict === "suspect" || judged.verdict === "real"
  const kept = judged.tests.filter(
    (each) => each.verdict === "old" || each.unreachable || (each.verdict === "race" && !suspect),
  )
  if (kept.length === 0) return { failed: false }
  const log = logOf(io, judged.run)
  const urls = { race: [], old: [] }
  for (const each of kept) {
    const done = keep({ repository, io, each, log, event })
    if (done.why !== undefined) {
      io.redMain(
        `${agentHeader}\n\nci failed on main in run ${runUrl(repository, event.id)}, and the bot could not record ${each.title}: ${done.why}`,
        ended,
      )
      return { failed: true }
    }
    urls[each.verdict].push(done.url)
  }
  io.redMain(recordedLine({ repository, event, races: urls.race, old: urls.old, suspect }), ended)
  return { failed: false }
}

export const recordEndedRaces = ({ repository, io, races, green }) => {
  const urls = []
  for (const each of races) {
    const kept = recordRace({
      gh: io.gh,
      repository,
      test: each.test,
      excerpt: testExcerpt(logOf(io, each.run), each.test),
      commit: each.run.sha,
      seen: `on main in ci run ${runUrl(repository, each.run.id)}, where ${each.why}, and the next push run on main passed at ${short(green.sha)} in ${runUrl(repository, green.id)}`,
    })
    if (kept.why !== undefined) return { why: kept.why, urls }
    urls.push(kept.url)
  }
  return { urls: [...new Set(urls)] }
}
