import { setTimeout } from "node:timers/promises"
import { agentHeader } from "./race-issue.mjs"

export const drillBranch = ({ sha, id, attempt }) => `red-main/drill-${sha}-${id}-${attempt}`

const workflows = [
  { name: "ci", event: "pull_request" },
  { name: "bar", event: "pull_request_target" },
]

const startedRun = ({ repository, io, pull, workflow }) => {
  const listed = io.gh([
    "run",
    "list",
    "--repo",
    repository,
    "--workflow",
    `${workflow.name}.yml`,
    "--branch",
    pull.branch,
    "--commit",
    pull.head,
    "--event",
    workflow.event,
    "--json",
    "headSha,status,url",
  ])
  if (listed.status !== 0) throw new Error(`could not list ${workflow.name} runs: ${listed.stderr.trim()}`)
  return JSON.parse(listed.stdout).find(
    (run) => run.headSha === pull.head && ["in_progress", "completed"].includes(run.status),
  )
}

export const removeDrillBranch = ({ io, branch, head, say }) => {
  const remote = io.remote ?? "origin"
  const ref = `refs/heads/${branch}`
  const removed = io.git(["push", remote, `--force-with-lease=${ref}:${head}`, "--delete", branch])
  if (removed.status === 0 || io.git(["ls-remote", "--exit-code", remote, ref]).status === 2) return true
  say(`could not delete ${branch}: ${removed.stderr.trim()}`)
  return false
}

export const finishDrill = async ({ repository, io, pull, close, say }) => {
  say(`opened drill pull request ${pull.url} on ${pull.branch}`)
  const started = new Map()
  let fault
  try {
    for (let poll = 0; poll < 30 && started.size < workflows.length; poll += 1) {
      if (poll > 0) await (io.sleep ?? setTimeout)(10000)
      for (const workflow of workflows.filter(({ name }) => !started.has(name))) {
        const run = startedRun({ repository, io, pull, workflow })
        if (run !== undefined) started.set(workflow.name, run.url)
      }
    }
    if (started.size < workflows.length)
      fault = `Timed out waiting for ${workflows
        .filter(({ name }) => !started.has(name))
        .map(({ name }) => name)
        .join(" and ")} to start.`
  } catch (error) {
    fault = error.message
  }
  const runs = [...started].map(([name, url]) => `${name} started at ${url}`).join("\n\n")
  const comment = [fault, runs, "The red-main drill closes this pull request."].filter(Boolean).join("\n\n")
  const closed = close(comment)
  if (closed.status !== 0) say(`could not close ${pull.url}: ${closed.stderr.trim()}`)
  const deleted = removeDrillBranch({ io, ...pull, say })
  const outcome = `Red-main drill ${pull.url}. ${closed.status === 0 ? "Closed the pull request." : "Closing the pull request failed."} ${deleted ? `Deleted branch ${pull.branch}.` : "Deleting the branch failed."}\n\n${[fault, runs].filter(Boolean).join("\n\n")}`
  say(outcome.trim())
  const recorded = io.redMain(`${agentHeader}\n\n${outcome.trim()}`, true)
  return { failed: fault !== undefined || closed.status !== 0 || !deleted || recorded.status !== 0 }
}
