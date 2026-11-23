import path from "node:path"
import { fileURLToPath } from "node:url"
import { knowsMain, pushedRefs } from "./checked.mjs"
import { runner, succeeds } from "./land-git.mjs"

export const rebuildCommand = "node scripts/linear-branch.mjs --rebuild"
const listed = 8

export const mergesSince = (git, { tip = "HEAD", main = "origin/main" } = {}) =>
  succeeds(
    git(["log", "--merges", "--format=%H%x00%s", `${main}..${tip}`]),
    `could not list the merge commits in ${main}..${tip}`,
  )
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const [hash, subject] = line.split("\0")
      return { hash, subject }
    })

export const linearFault = ({ merges, branch }) => {
  if (merges.length === 0) return undefined
  const shown = merges.slice(0, listed).map(({ hash, subject }) => `  ${hash.slice(0, 8)} ${subject}`)
  return [
    `${merges.length} merge ${merges.length === 1 ? "commit" : "commits"} in ${branch ?? "this branch"} since origin/main:`,
    ...shown,
    ...(merges.length > listed ? [`  and ${merges.length - listed} more`] : []),
    "A rebase merge, in the merge queue or by pnpm land with no queue, replays commit by commit and cannot replay a merge commit: the queue drops this pull request as merge_conflict, and GitHub refuses the rebase.",
    `Rebuild the net change of the branch as one commit on the main you tested: ${rebuildCommand}`,
    "Add --message <title> to name the commit; it keeps the subject of the last commit by default. pnpm land does this for you before its checks.",
  ].join("\n")
}

const workInProgress = /^\s*(?:wip\b|fixup!|squash!|amend!)/i

export const wipsSince = (git, { tip = "HEAD", main = "origin/main" } = {}) =>
  succeeds(
    git(["log", "--no-merges", "--format=%H%x00%s", `${main}..${tip}`]),
    `could not list the commits in ${main}..${tip}`,
  )
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const [hash, subject] = line.split("\0")
      return { hash, subject }
    })
    .filter(({ subject }) => workInProgress.test(subject))

export const wipFault = ({ wips, branch }) => {
  if (wips.length === 0) return undefined
  const shown = wips.slice(0, listed).map(({ hash, subject }) => `  ${hash.slice(0, 8)} ${subject}`)
  return [
    `${wips.length} work-in-progress ${wips.length === 1 ? "commit" : "commits"} in ${branch ?? "this branch"} since origin/main:`,
    ...shown,
    ...(wips.length > listed ? [`  and ${wips.length - listed} more`] : []),
    "A WIP commit keeps work in your own worktree, and commits as fast as any other with no flag; it never ships.",
    `Rebuild the branch's net change as one commit with its real title: ${rebuildCommand} --message "<title>"`,
  ].join("\n")
}

const conflictNames = (stdout) => {
  const [, ...rest] = stdout.split("\n")
  return rest.slice(0, rest.indexOf("")).filter((name) => name !== "")
}

export const rebuildBranch = (git, { message, main = "origin/main" } = {}) => {
  const dirty = succeeds(git(["status", "--porcelain", "--untracked-files=all"]), "could not read the working tree")
    .split("\n")
    .filter((line) => line !== "")
  if (dirty.length > 0)
    return {
      ok: false,
      why: `${dirty.length} files are not committed (${dirty
        .slice(0, 5)
        .map((line) => line.slice(3))
        .join(", ")}). Commit them first, so the rebuild keeps them.`,
    }
  const parent = succeeds(git(["rev-parse", "--verify", `${main}^{commit}`]), `could not read ${main}`).trim()
  const before = succeeds(git(["rev-parse", "--verify", "HEAD^{commit}"]), "could not read HEAD").trim()
  const merged = git(["merge-tree", "--write-tree", "--name-only", parent, before])
  if (merged.status === 1)
    return {
      ok: false,
      conflicts: conflictNames(merged.stdout),
      why: `the branch conflicts with ${main} in ${conflictNames(merged.stdout).join(", ")}, so its net change cannot be placed on it. Resolve that first: git rebase ${main}.`,
    }
  const tree = succeeds(merged, `could not merge ${before} onto ${parent}`).split("\n")[0].trim()
  const subject =
    message ??
    succeeds(git(["log", "--no-merges", "-1", "--format=%s", before]), "could not read the last commit").trim()
  const rebuilt = succeeds(git(["commit-tree", tree, "-p", parent, "-m", subject]), "could not write the commit").trim()
  const kept = succeeds(git(["rev-parse", `${rebuilt}^{tree}`]), "could not read the new tree").trim()
  if (kept !== tree) return { ok: false, why: `the rebuilt commit holds tree ${kept}, not the net change ${tree}.` }
  succeeds(git(["reset", "--keep", rebuilt]), "could not move the branch to the rebuilt commit")
  return { ok: true, before, after: rebuilt, parent, tree }
}

export const rebuildLine = ({ before, after, parent }) =>
  `rebuilt ${before.slice(0, 8)} as one commit ${after.slice(0, 8)} on origin/main at ${parent.slice(0, 8)}; its tree is what merging ${before.slice(0, 8)} into main gives. To go back: git reset --hard ${before}`

export const pushFaults = (root, pushed) => {
  const git = runner("git", root)
  return pushedRefs(pushed).flatMap(({ ref, commit }) =>
    [
      linearFault({ merges: mergesSince(git, { tip: commit }), branch: ref }),
      wipFault({ wips: wipsSince(git, { tip: commit }), branch: ref }),
    ].filter((fault) => fault !== undefined),
  )
}

const eventTip = (git, event) => {
  if (event !== "pull_request") return "HEAD"
  const parents = succeeds(git(["rev-list", "--parents", "-n", "1", "HEAD"]), "could not read HEAD")
    .trim()
    .split(" ")
  return parents.length === 3 ? "HEAD^2" : "HEAD"
}

const optionValue = (argv, name) => {
  const at = argv.indexOf(name)
  return at === -1 ? undefined : argv[at + 1]
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const root = path.resolve(path.dirname(self), "..")
  const git = runner("git", root)
  const argv = process.argv.slice(2)
  if (!knowsMain(root)) {
    console.error("origin/main is missing, so no branch can be judged. Run git fetch origin main.")
    process.exit(1)
  }
  if (argv.includes("--rebuild")) {
    const result = rebuildBranch(git, { message: optionValue(argv, "--message") })
    console.log(result.ok ? rebuildLine(result) : `linear-branch: not rebuilt: ${result.why}`)
    process.exit(result.ok ? 0 : 1)
  }
  const tip = eventTip(git, process.env.GITHUB_EVENT_NAME)
  const faults = [linearFault({ merges: mergesSince(git, { tip }) }), wipFault({ wips: wipsSince(git, { tip }) })]
  if (faults.some((fault) => fault !== undefined)) {
    for (const fault of faults.filter((each) => each !== undefined)) console.error(fault)
    process.exit(1)
  }
  const count = succeeds(git(["rev-list", "--count", `origin/main..${tip}`]), "could not count the commits").trim()
  console.log(`linear-branch: ${count} commits since origin/main, none a merge or work-in-progress commit`)
}
