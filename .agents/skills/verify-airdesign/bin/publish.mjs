import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import path from "node:path"
import { proofBranch } from "../../../../scripts/checked.mjs"

export const proofRef = `refs/heads/${proofBranch}`
const rejected = /non-fast-forward|fetch first|\[rejected\]|stale info|cannot lock ref/

export function proofFolder({ pr, branch }) {
  if (pr !== undefined) {
    if (!/^\d+$/.test(String(pr))) throw new Error(`--pr takes a pull request number, not ${String(pr)}`)
    return `pr-${String(pr)}`
  }
  const name = String(branch ?? "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (name === "") throw new Error("name the pull request with --pr <number>; this checkout has no branch name")
  return `branch-${name}`
}

export function githubRepository(url) {
  const found = String(url)
    .trim()
    .match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/)
  if (!found) throw new Error(`origin is not a GitHub repository: ${String(url)}`)
  return `${found[1]}/${found[2]}`
}

export function imageLink(repository, commit, file) {
  return `https://github.com/${repository}/blob/${commit}/${file.split("/").map(encodeURIComponent).join("/")}?raw=true`
}

function gitIn(root, env) {
  return (args, input) =>
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      env: { ...process.env, ...env },
      input,
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 1 << 26,
    }).trim()
}

function remoteTip(git, remote) {
  const line = git(["ls-remote", remote, proofRef])
  if (line === "") return undefined
  const tip = line.split(/\s+/)[0]
  git(["fetch", "--quiet", "--no-tags", "--no-write-fetch-head", remote, proofRef])
  return tip
}

function commitOnce({ root, git, files, folder, remote, scratch, message }) {
  const parent = remoteTip(git, remote)
  const index = mkdtempSync(path.join(scratch, "proof-index-"))
  try {
    const staged = gitIn(root, { GIT_INDEX_FILE: path.join(index, "index") })
    if (parent === undefined) staged(["read-tree", "--empty"])
    else staged(["read-tree", parent])
    const placed = {}
    for (const file of files) {
      const blob = git(["hash-object", "-w", "--", file])
      const into = `${folder}/${path.basename(file)}`
      staged(["update-index", "--add", "--cacheinfo", `100644,${blob},${into}`])
      placed[file] = into
    }
    const tree = staged(["write-tree"])
    const commit = git(["commit-tree", tree, ...(parent === undefined ? [] : ["-p", parent]), "-m", message])
    return { commit, placed }
  } finally {
    rmSync(index, { recursive: true, force: true })
  }
}

export function publish({ root, files, folder, scratch, remote = "origin", attempts = 5 }) {
  if (files.length === 0) throw new Error("nothing to publish: name a folder with PNG files")
  const names = files.map((file) => path.basename(file))
  const twice = names.find((name, index) => names.indexOf(name) !== index)
  if (twice) throw new Error(`two files are named ${twice}; publish puts every file in one folder`)
  const strange = files.find((file) => !file.endsWith(".png"))
  if (strange) throw new Error(`${strange} is not a PNG; the proof branch holds only PNG images`)
  const git = gitIn(root, {})
  const message = `Proof images for ${folder}.`
  for (let attempt = 1; ; attempt += 1) {
    const { commit, placed } = commitOnce({ root, git, files, folder, remote, scratch, message })
    try {
      git(["push", "--quiet", remote, `${commit}:${proofRef}`])
      return { commit, placed, attempts: attempt }
    } catch (error) {
      const said = String(error.stderr ?? error.message)
      if (attempt >= attempts || !rejected.test(said)) throw new Error(`push to ${proofBranch} failed: ${said.trim()}`)
    }
  }
}
