import { behindMain, conflictsWithMain } from "./land-git.mjs"
import { failedRunFor } from "./land-follow.mjs"
import { ciFailureLines } from "./land-report.mjs"
import { baseFault } from "./pull-base.mjs"
import { queueLine, removalLine } from "./merge-queue.mjs"

const checksLine = ({ passed, running, failed }) =>
  `${passed.length} passed, ${running.length} running, ${failed.length} failed`

const unfinishedLine = ({ running, failed }) => {
  const named = [...running.map((name) => `${name} still running`), ...failed.map((name) => `${name} failed`)]
  return named.length === 0 ? "" : ` (${named.sort().join(", ")})`
}

export const statusLines = ({ number, branch, repository, pull, git, gh, ref = "HEAD" }) => {
  const lines = [
    `pull request ${number} targets ${pull.base}${baseFault(number, pull.base) === undefined ? "" : ". Wrong base. Fix: run pnpm land in its branch; it moves the base to main"}`,
  ]
  if (pull.merged) lines.push("state       merged")
  lines.push(`mergeable   ${pull.mergeable} (merge state ${pull.mergeState})`)
  const conflicts = conflictsWithMain(git, ref)
  lines.push(
    conflicts.length === 0
      ? "conflicts   none with origin/main"
      : `conflicts   with origin/main in ${conflicts.join(", ")}. Rebase: git fetch origin main && git rebase origin/main`,
  )
  lines.push(`behind      ${behindMain(git, ref)} commits behind origin/main`)
  lines.push(`checks      required: ${checksLine(pull.required)}${unfinishedLine(pull.required)}`)
  lines.push(`            not required: ${checksLine(pull.advisory)}${unfinishedLine(pull.advisory)}`)
  lines.push(`queue       ${queueLine(pull)}`)
  if (removalLine(pull) !== undefined) lines.push(`removed     ${removalLine(pull)}`)
  const failed = failedRunFor({ gh, repository, branch, head: pull.head, number, event: "pull_request" })
  lines.push(
    failed === undefined
      ? "last failure none on this head"
      : `last failure ${ciFailureLines({ repository, run: failed, gh, git }).join("\n              ")}`,
  )
  return lines
}
