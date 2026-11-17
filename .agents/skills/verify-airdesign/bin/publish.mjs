import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

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

function ghIn(args, options = {}) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 1 << 26,
    ...options,
  }).trim()
}

export function githubRepository(source = ghIn) {
  if (typeof source === "string") {
    const found = source.trim().match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/)
    if (!found) throw new Error(`origin is not a GitHub repository: ${source}`)
    return `${found[1]}/${found[2]}`
  }
  const runner = typeof source === "function" ? source : ghIn
  const output = runner(["repo", "view", "--json", "nameWithOwner"])
  const parsed = typeof output === "object" ? output : JSON.parse(output)
  return parsed.nameWithOwner
}

export function assetName({ prefix, file, bytes }) {
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 10)
  const kind = path.extname(file)
  const base = path
    .basename(file, kind)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `${prefix}-${base}-${hash}${kind}`
}

export function imageLink(repository, asset, release = "proof") {
  return `https://github.com/${repository}/releases/download/${release}/${encodeURIComponent(asset)}`
}

const proofRelease = {
  title: "Proof images",
  notes: "Screenshots attached to pull requests. Not a product release.",
}

export function publish({
  files,
  prefix,
  folder,
  scratch,
  release = "proof",
  kinds = [".png"],
  about = proofRelease,
  repository,
  runGh = ghIn,
}) {
  if (files.length === 0) throw new Error("nothing to publish: name a folder with PNG files")
  const names = files.map((file) => path.basename(file))
  const twice = names.find((name, index) => names.indexOf(name) !== index)
  if (twice) throw new Error(`two files are named ${twice}; publish puts every file in one folder`)
  const strange = files.find((file) => !kinds.includes(path.extname(file)))
  if (strange) {
    if (kinds.length === 1 && kinds[0] === ".png")
      throw new Error(`${strange} is not a PNG; the proof release holds only PNG images`)
    throw new Error(`${path.basename(strange)} is not one of ${kinds.join(", ")}`)
  }

  const resolvedPrefix = prefix ?? (folder ? folder.split("/")[0] : undefined)
  if (!resolvedPrefix) throw new Error("publish requires a prefix or folder")

  const repo = repository ?? githubRepository(runGh)

  let existingAssets = []
  try {
    const view = runGh(["release", "view", release, "--json", "assets"])
    const parsed = typeof view === "object" ? view : JSON.parse(view)
    existingAssets = (parsed.assets ?? []).map((asset) => asset.name)
  } catch (error) {
    const message = String(error.stderr ?? error.message)
    if (message.includes("release not found") || message.includes("Not Found") || message.includes("404")) {
      runGh(["release", "create", release, "--prerelease", "--title", about.title, "--notes", about.notes])
    } else {
      throw error
    }
  }

  const existingSet = new Set(existingAssets)
  const scratchDir = mkdtempSync(path.join(scratch ?? os.tmpdir(), "proof-upload-"))
  const placed = {}
  const toUpload = []
  try {
    for (const file of files) {
      const bytes = readFileSync(file)
      const asset = assetName({ prefix: resolvedPrefix, file, bytes })
      const base = path.basename(file)
      placed[base] = asset
      if (!existingSet.has(asset)) {
        const stagePath = path.join(scratchDir, asset)
        copyFileSync(file, stagePath)
        toUpload.push(stagePath)
      }
    }
    if (toUpload.length > 0) {
      runGh(["release", "upload", release, ...toUpload])
    }
  } finally {
    rmSync(scratchDir, { recursive: true, force: true })
  }

  const links = Object.fromEntries(
    Object.entries(placed).map(([base, asset]) => [base, imageLink(repo, asset, release)]),
  )
  return { release, placed, links, repository: repo }
}
