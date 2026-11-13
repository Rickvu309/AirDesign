import path from "node:path"
import { fileURLToPath } from "node:url"
import { runner, succeeds } from "./land-git.mjs"

export const absent = "0".repeat(40)
export const windowSize = 200
export const restoredLimit = 2
const listLimit = 20

export const putBack = ({ changed, history, excused = [] }) =>
  changed
    .filter((file) => !excused.includes(file.path))
    .flatMap((file) => {
      for (const { commit, subject, entries } of history) {
        const undone = entries.find(
          (entry) => entry.path === file.path && entry.before === file.blob && entry.after !== entry.before,
        )
        if (undone !== undefined) return [{ path: file.path, commit, subject, deleted: file.blob === absent }]
      }
      return []
    })

const marker = /^Reverts:\s*(.+?)\s*$/

export const revertsNamed = (text) =>
  text
    .split("\n")
    .map((line) => marker.exec(line)?.[1])
    .filter((named) => named !== undefined)

const entriesOf = (tokens) => {
  const entries = []
  for (let at = 0; at + 1 < tokens.length; at += 2) {
    const [, , before, after] = tokens[at].trim().split(" ")
    entries.push({ path: tokens[at + 1], before, after })
  }
  return entries
}

const tokensOf = (text) => text.split("\0").filter((token) => token.trim() !== "")

const historyOf = (text) =>
  text
    .split("\u0001")
    .filter((chunk) => chunk !== "")
    .map((chunk) => {
      const [head, ...tokens] = tokensOf(chunk)
      const [commit, subject] = head.split("\u0002")
      return { commit, subject, entries: entriesOf(tokens) }
    })

const rawDiff = (git, from, to) =>
  entriesOf(tokensOf(succeeds(git(["diff", "--raw", "--no-renames", "--no-abbrev", "-z", from, to]), "could not diff")))

export const staleFiles = (git, { head = "HEAD", main = "origin/main", depth = windowSize } = {}) => {
  const base = succeeds(git(["merge-base", main, head]), `could not find where ${head} left ${main}`).trim()
  const fromTip = new Set(rawDiff(git, main, head).map((entry) => entry.path))
  const changed = rawDiff(git, base, head)
    .filter((entry) => fromTip.has(entry.path))
    .map((entry) => ({ path: entry.path, blob: entry.after }))
  if (changed.length === 0) return []
  const logged = git([
    "log",
    "--first-parent",
    "--raw",
    "--no-renames",
    "--no-abbrev",
    "-z",
    "--format=%x01%H%x02%s",
    "-n",
    String(depth),
    base,
  ])
  const history = historyOf(succeeds(logged, "could not read the history of main"))
  const bodies = succeeds(git(["log", "--format=%B", `${base}..${head}`]), "could not read the commit bodies")
  return putBack({ changed, history, excused: revertsNamed(bodies) })
}

export const staleFault = (files) => {
  if (files.filter((file) => !file.deleted).length < restoredLimit) return undefined
  const listed = files.map(
    (file) =>
      `  ${file.path}: ${file.deleted ? "deleted, as it was before" : "back to its content before"} ${file.commit.slice(0, 8)} ${file.subject}`,
  )
  const paths = files.map((file) => file.path).join(" ")
  return [
    `${files.length} files are put back to content that main has since replaced:`,
    ...listed.slice(0, listLimit),
    ...(listed.length > listLimit ? [`  and ${listed.length - listLimit} more`] : []),
    "This usually means the commit was rebuilt from a stale tree: a squash or git reset --soft made after origin/main moved, so it carries the old version of files other people changed.",
    "If the branch on GitHub is right, go back to it: git reset --hard origin/<your branch>.",
    `Otherwise take main's version of these files, so the commit keeps only your own changes: git restore --source=origin/main --staged --worktree -- ${paths} && git commit --amend --no-edit`,
    "If you mean to revert a file, add a line Reverts: <path> to the commit body for each one.",
  ].join("\n")
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const fault = staleFault(staleFiles(runner("git", path.resolve(path.dirname(self), ".."))))
  if (fault !== undefined) {
    console.error(fault)
    process.exit(1)
  }
}
