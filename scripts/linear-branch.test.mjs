import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { runner } from "./land-git.mjs"
import {
  linearFault,
  mergesSince,
  pushFaults,
  rebuildBranch,
  rebuildCommand,
  wipFault,
  wipsSince,
} from "./linear-branch.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "linear-branch-"))
process.on("exit", () => fs.rmSync(folder, { recursive: true, force: true }))
const here = path.dirname(fileURLToPath(import.meta.url))

const scratch = (name) => {
  const root = path.join(folder, name)
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true })
  for (const file of ["checked.mjs", "commit-authors.mjs", "land-git.mjs", "linear-branch.mjs", "pre-push.mjs"])
    fs.copyFileSync(path.join(here, file), path.join(root, "scripts", file))
  fs.mkdirSync(path.join(root, ".git", "info"), { recursive: true })
  fs.writeFileSync(path.join(root, ".git", "info", "exclude"), "scripts/\n")
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  const write = (file, text) => fs.writeFileSync(path.join(root, file), text)
  const commitFile = (file, text, message) => {
    write(file, text)
    git("add", file)
    git("commit", "-q", "-m", message)
    return git("rev-parse", "HEAD")
  }
  git("init", "-q", "-b", "main")
  git("config", "user.name", "Quan Vu")
  git("config", "user.email", "193299474+quanvu309@users.noreply.github.com")
  const base = commitFile("a.txt", "a\n", "Base.")
  git("update-ref", "refs/remotes/origin/main", base)
  return { root, git, write, commitFile, run: runner("git", root), base }
}

const mergeShape = (name) => {
  const repo = scratch(name)
  const { git, commitFile, base } = repo
  git("switch", "-q", "-c", "work")
  commitFile("feature.txt", "feature\n", "Add the feature.")
  git("update-ref", "refs/heads/old-main", base)
  git("switch", "-q", "--detach", base)
  const moved = commitFile("main-only.txt", "main moved\n", "Main moved.")
  git("update-ref", "refs/remotes/origin/main", moved)
  git("switch", "-q", "work")
  git("merge", "-q", "--no-ff", "-m", "Merge origin/main into work", "origin/main")
  commitFile("feature-two.txt", "two\n", "Finish the feature.")
  return { ...repo, moved }
}

const linear = scratch("linear")
linear.git("switch", "-q", "-c", "work")
linear.commitFile("feature.txt", "feature\n", "Add the feature.")
same("a branch of plain commits holds no merge commit", mergesSince(linear.run), [])
same("so there is nothing to refuse", linearFault({ merges: [], branch: "work" }), undefined)

const shape = mergeShape("merged")
const merges = mergesSince(shape.run)
same("a branch with main merged inside it holds one merge commit", merges.length, 1)
same("and names its subject", merges[0].subject, "Merge origin/main into work")
const fault = linearFault({ merges })
for (const [what, part] of [
  ["names the merge commit", merges[0].hash.slice(0, 8)],
  ["says the queue drops it", "merge_conflict"],
  ["says the queue rebases commit by commit", "commit by commit"],
  ["prints the rebuild command", rebuildCommand],
  ["says pnpm land does it", "pnpm land"],
])
  same(`the refusal ${what}`, fault.includes(part), true)
same("the printed command is one that exists in this repo", rebuildCommand, "node scripts/linear-branch.mjs --rebuild")

const step = (repo, event, tipEnv = {}) => {
  const env = { ...process.env, ...tipEnv }
  delete env.GITHUB_EVENT_NAME
  if (event !== undefined) env.GITHUB_EVENT_NAME = event
  const ran = spawnSync(process.execPath, ["scripts/linear-branch.mjs"], { cwd: repo.root, encoding: "utf8", env })
  return { status: ran.status, out: ran.stdout, err: ran.stderr }
}
const refused = step(shape)
same("the check refuses a branch with a merge commit inside it", refused.status, 1)
same("and prints the rebuild command", refused.err.includes(rebuildCommand), true)
same("the check passes a linear branch", step(linear).status, 0)
same(
  "and says what it judged",
  step(linear).out,
  "linear-branch: 1 commits since origin/main, none a merge or work-in-progress commit\n",
)

const wip = scratch("wip")
wip.git("switch", "-q", "-c", "work")
wip.commitFile("editor.txt", "half\n", "wip: remove the old editor")
wip.commitFile("line.txt", "snap\n", "WIP: Gemini line end snap and Shift angle")
wip.commitFile("done.txt", "done\n", "Remove the old editor")
const wips = wipsSince(wip.run)
same(
  "replaying 9b0587d26 and 7f6db26e5, the two WIP commits that reached main, finds both",
  wips.map((each) => each.subject),
  ["WIP: Gemini line end snap and Shift angle", "wip: remove the old editor"],
)
same("a title that only starts with a word like wipe is not work in progress", wipsSince(linear.run), [])
const wipRefusal = wipFault({ wips, branch: "work" })
for (const [what, part] of [
  ["names the commit", wips[0].hash.slice(0, 8)],
  ["prints the rebuild command with a title", `${rebuildCommand} --message`],
])
  same(`the work-in-progress refusal ${what}`, wipRefusal.includes(part), true)
const wipStep = step(wip)
same("the check refuses a branch that holds a WIP commit", wipStep.status, 1)
same("and names it", wipStep.err.includes("wip: remove the old editor"), true)
same(
  "the pre-push hook refuses to push it",
  pushFaults(wip.root, `refs/heads/work ${wip.git("rev-parse", "HEAD")} refs/heads/work ${"0".repeat(40)}\n`).length,
  1,
)

const githubMerge = (repo, head) => {
  const tree = repo.git("rev-parse", `${head}^{tree}`)
  const merged = repo.git(
    "commit-tree",
    tree,
    "-p",
    repo.git("rev-parse", "origin/main"),
    "-p",
    head,
    "-m",
    "Merge the pull request",
  )
  repo.git("update-ref", "--no-deref", "HEAD", merged)
  return merged
}
const onGithub = scratch("on-github")
onGithub.git("switch", "-q", "-c", "work")
const linearHead = onGithub.commitFile("feature.txt", "feature\n", "Add the feature.")
githubMerge(onGithub, linearHead)
same("a pull_request run does not blame GitHub's own merge commit", step(onGithub, "pull_request").status, 0)
const onGithubMerged = mergeShape("on-github-merged")
githubMerge(onGithubMerged, onGithubMerged.git("rev-parse", "work"))
same(
  "a pull_request run refuses a merge commit inside the pull request",
  step(onGithubMerged, "pull_request").status,
  1,
)

const noMain = scratch("no-main")
noMain.git("update-ref", "-d", "refs/remotes/origin/main")
same("without origin/main the check fails", step(noMain).status, 1)
same("and says so", step(noMain).err.includes("origin/main is missing"), true)

const zero = "0".repeat(40)
const pushOf = (local, remote = zero) => `refs/heads/work ${local} refs/heads/work ${remote}\n`
const workHead = shape.git("rev-parse", "work")
same("a push of a branch with a merge commit is refused", pushFaults(shape.root, pushOf(workHead)).length, 1)
same("and names the rebuild command", pushFaults(shape.root, pushOf(workHead))[0].includes(rebuildCommand), true)
same("a push of a linear branch passes", pushFaults(linear.root, pushOf(linear.git("rev-parse", "HEAD"))), [])
same("a deleted ref is skipped", pushFaults(shape.root, `(delete) ${zero} refs/heads/work ${workHead}\n`), [])

const before = shape.git("rev-parse", "HEAD")
const treeBefore = shape.git("rev-parse", "HEAD^{tree}")
const pinned = shape.git("rev-parse", "origin/main")
const expectedTree = shape.git("merge-tree", "--write-tree", pinned, before).split("\n")[0]
same("the rebuild loses nothing: the net change of the branch is what a merge would give", treeBefore, expectedTree)
const rebuilt = rebuildBranch(shape.run, { message: "Add the feature." })
same("a branch with a merge commit rebuilds", rebuilt.ok, true)
same("the rebuild names the head it replaced", rebuilt.before, before)
const after = shape.git("rev-parse", "HEAD")
same("HEAD is the rebuilt commit", rebuilt.after, after)
same("the rebuilt branch is one commit past main", shape.git("rev-list", "--count", "origin/main..HEAD"), "1")
same("whose only parent is the main it was built on", shape.git("rev-parse", "HEAD^"), pinned)
same("with no merge commit", shape.git("rev-list", "--merges", "origin/main..HEAD"), "")
same("with the tree the old head had", shape.git("rev-parse", "HEAD^{tree}"), treeBefore)
same("with the message asked for", shape.git("log", "-1", "--format=%s"), "Add the feature.")
same("with a clean working tree", shape.git("status", "--porcelain"), "")
for (const file of ["feature.txt", "feature-two.txt", "main-only.txt"])
  same(`and ${file} still there`, fs.existsSync(path.join(shape.root, file)), true)
same("and the old head stays reachable by the sha the rebuild printed", shape.git("cat-file", "-t", before), "commit")
same("the rebuilt branch is linear", mergesSince(shape.run), [])
same("the check passes after the rebuild", step(shape).status, 0)

const unnamed = mergeShape("unnamed")
same(
  "a rebuild with no message names the commit after the last commit of the branch",
  rebuildBranch(unnamed.run).ok,
  true,
)
same("and so keeps its subject", unnamed.git("log", "-1", "--format=%s"), "Finish the feature.")

const clash = scratch("clash")
clash.git("switch", "-q", "-c", "work")
clash.commitFile("a.txt", "branch\n", "Change a on the branch.")
clash.git("switch", "-q", "--detach", clash.base)
const mainChange = clash.commitFile("a.txt", "main\n", "Change a on main.")
clash.git("update-ref", "refs/remotes/origin/main", mainChange)
clash.git("switch", "-q", "work")
clash.git("merge", "-q", "--no-ff", "-X", "ours", "-m", "Merge origin/main into work", "origin/main")
clash.commitFile("b.txt", "b\n", "Add b.")
clash.git("switch", "-q", "--detach", mainChange)
const mainAgain = clash.commitFile("a.txt", "main again\n", "Change a on main again.")
clash.git("update-ref", "refs/remotes/origin/main", mainAgain)
clash.git("switch", "-q", "work")
const headBeforeClash = clash.git("rev-parse", "HEAD")
const clashed = rebuildBranch(clash.run, { message: "Change a." })
same("a branch that conflicts with main is not rebuilt", clashed.ok, false)
same("and says which file", clashed.conflicts, ["a.txt"])
same("and leaves HEAD where it was", clash.git("rev-parse", "HEAD"), headBeforeClash)

const dirty = mergeShape("dirty")
dirty.write("scratch.txt", "not committed\n")
const headDirty = dirty.git("rev-parse", "HEAD")
const stopped = rebuildBranch(dirty.run, { message: "x" })
same("a rebuild does not start over uncommitted files", stopped.ok, false)
same("and says they are uncommitted", stopped.why.includes("not committed"), true)
same("and leaves HEAD where it was", dirty.git("rev-parse", "HEAD"), headDirty)
same("and leaves the file", fs.existsSync(path.join(dirty.root, "scratch.txt")), true)

const cli = mergeShape("cli")
const ranCli = spawnSync(
  process.execPath,
  ["scripts/linear-branch.mjs", "--rebuild", "--message", "Add the feature."],
  {
    cwd: cli.root,
    encoding: "utf8",
  },
)
same("the printed command rebuilds the branch", ranCli.status, 0)
same("and the branch is then linear", step(cli).status, 0)
same("and says what it replaced", ranCli.stdout.includes("rebuilt"), true)

const prePush = (repo, input) => {
  const ran = spawnSync(process.execPath, ["scripts/pre-push.mjs"], { cwd: repo.root, encoding: "utf8", input })
  return { status: ran.status, err: ran.stderr }
}
const pushing = mergeShape("pushing")
const pushedMerge = prePush(pushing, pushOf(pushing.git("rev-parse", "HEAD")))
same("git push refuses a branch with a merge commit inside it", pushedMerge.status, 1)
same("and prints the rebuild command", pushedMerge.err.includes(rebuildCommand), true)
const pushedLinear = prePush(linear, pushOf(linear.git("rev-parse", "HEAD")))
same("git push does not name a merge commit on a linear branch", pushedLinear.err.includes("merge commit"), false)
