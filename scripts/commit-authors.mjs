import { execFileSync, spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { knowsMain, pushedRefs } from "./checked.mjs"

const owners = [
  { name: "rickvu", email: "minhquanvu3902@gmail.com" },
  { name: "Quan Vu", email: "193299474+quanvu309@users.noreply.github.com" },
]
const ownerNames = owners.map(({ name, email }) => `${name} <${email}>`).join(" or ")
const coAuthorTrailer = /^[ \t]*co-authored-by[ \t]*:/im
const generatedLine =
  /^[^\w\n]*generated[ \t-]+(?:with|by)\b[^\w\n]*(?:claude|anthropic|codex|openai|chatgpt|gpt|grok|copilot|gemini|aider|devin|droid)\b/im
const attributionBot = /factory-droid/i
const agentLine = /^[^\w\n]*(?:\u{1F916}|\*\*)[^\w\n]*(?:[\w.-]+ ){1,4}responding on behalf of\b/iu
const reviewLine = /^[^\w\n]*reviewed with sol-loop\b/i
const largeOutput = 64 * 1024 * 1024
const eventsThatAddCommits = new Set(["pull_request", "merge_group"])

export const attributionLine = (text) =>
  text
    .split(/\r?\n/)
    .find((line) => [generatedLine, attributionBot, agentLine, reviewLine].some((banned) => banned.test(line)))
    ?.trim()

export const commitFix =
  "Amend or rebase with the repo's git config and drop the trailer: git commit --amend --reset-author, or git rebase origin/main --exec 'git commit --amend --no-edit --reset-author'."

export const commitFaults = ({ authorName, authorEmail, message }) => [
  ...(owners.some(({ name, email }) => authorName === name && authorEmail === email)
    ? []
    : [`the author is ${authorName} <${authorEmail}>, and every commit is authored by ${ownerNames}`]),
  ...(coAuthorTrailer.test(message) ? ["the message has a Co-authored-by trailer"] : []),
  ...(attributionLine(message) !== undefined ? ["the message has an AI attribution line"] : []),
]

export const commitsIn = (root, revisions) => {
  const fields = execFileSync(
    "git",
    ["log", "--no-merges", "--format=%H%x00%an%x00%ae%x00%B%x00", ...revisions, "--"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: largeOutput,
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).split("\0")
  const commits = []
  for (let at = 0; at + 3 < fields.length; at += 4) {
    commits.push({
      hash: fields[at].trim(),
      authorName: fields[at + 1],
      authorEmail: fields[at + 2],
      message: fields[at + 3],
    })
  }
  return commits
}

export const refusals = (commits) => {
  const lines = commits
    .map((commit) => [commit.hash, commitFaults(commit)])
    .filter(([, faults]) => faults.length > 0)
    .map(([hash, faults]) => `commit ${hash.slice(0, 8)} refused: ${faults.join("; ")}.`)
  return lines.length > 0 ? [...lines, commitFix] : []
}

const isCommit = (root, name) =>
  spawnSync("git", ["cat-file", "-e", `${name}^{commit}`], { cwd: root, stdio: "ignore" }).status === 0

export const pushRefusals = (root, pushed) =>
  refusals(
    pushedRefs(pushed).flatMap(({ commit, remote }) =>
      commitsIn(root, [commit, "--not", "origin/main", ...(remote && isCommit(root, remote) ? [remote] : [])]),
    ),
  )

export const branchRefusals = (root, event) => {
  if (!knowsMain(root)) return ["origin/main is missing, so no commit can be judged. Run git fetch origin main."]
  const commits = commitsIn(root, ["origin/main..HEAD"])
  if (commits.length === 0 && eventsThatAddCommits.has(event))
    return [`a ${event} run found no commits in origin/main..HEAD, so it judged nothing.`]
  return refusals(commits)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const refused = branchRefusals(root, process.env.GITHUB_EVENT_NAME)
  if (refused.length > 0) {
    for (const line of refused) console.error(line)
    process.exit(1)
  }
  console.log(
    `commit-authors: ${commitsIn(root, ["origin/main..HEAD"]).length} commits since origin/main, none refused`,
  )
}
