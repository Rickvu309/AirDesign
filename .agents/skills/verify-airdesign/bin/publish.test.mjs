import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { githubRepository, imageLink, proofFolder, proofRef, publish } from "./publish.mjs"

const folder = mkdtempSync(path.join(os.tmpdir(), "publish-"))
afterAll(() => rmSync(folder, { recursive: true, force: true }))
const identity = ["-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "-c", "commit.gpgsign=false"]
const git = (cwd, ...args) =>
  execFileSync("git", [...identity, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()

function clone(name) {
  const root = path.join(folder, name)
  git(folder, "clone", "-q", path.join(folder, "remote.git"), root)
  git(root, "config", "user.name", "fixture")
  git(root, "config", "user.email", "fixture@example.com")
  return root
}

function shots(name, files) {
  const dir = path.join(folder, `${name}-shots`)
  mkdirSync(dir, { recursive: true })
  return files.map((file) => {
    writeFileSync(path.join(dir, file), `${name} ${file}`)
    return path.join(dir, file)
  })
}

describe("publish", () => {
  git(folder, "init", "-q", "--bare", "-b", "main", "remote.git")
  const seed = path.join(folder, "seed")
  git(folder, "init", "-q", "-b", "main", seed)
  writeFileSync(path.join(seed, "code.mjs"), "code")
  git(seed, "add", "-A")
  git(seed, "commit", "-q", "-m", "seed")
  git(seed, "push", "-q", path.join(folder, "remote.git"), "main")

  it("commits images to the proof branch without touching the checkout, and a second publisher keeps the first's", () => {
    const first = clone("first")
    const second = clone("second")
    writeFileSync(path.join(first, "code.mjs"), "edited, not committed")
    const before = [
      git(first, "rev-parse", "HEAD"),
      git(first, "status", "--porcelain"),
      git(first, "branch", "--list"),
    ]
    const one = publish({ root: first, files: shots("one", ["annotated-1.png"]), folder: "pr-1/run", scratch: folder })
    expect([
      git(first, "rev-parse", "HEAD"),
      git(first, "status", "--porcelain"),
      git(first, "branch", "--list"),
    ]).toEqual(before)
    const two = publish({ root: second, files: shots("two", ["a.png", "b.png"]), folder: "pr-2/run", scratch: folder })
    const remote = path.join(folder, "remote.git")
    expect(git(remote, "rev-parse", proofRef)).toBe(two.commit)
    expect(git(remote, "rev-parse", `${two.commit}^`)).toBe(one.commit)
    expect(git(remote, "ls-tree", "-r", "--name-only", two.commit).split("\n")).toEqual([
      "pr-1/run/annotated-1.png",
      "pr-2/run/a.png",
      "pr-2/run/b.png",
    ])
    expect(git(remote, "rev-list", "--max-parents=0", two.commit)).toBe(one.commit)
    expect(git(remote, "rev-parse", "main")).toBe(git(seed, "rev-parse", "HEAD"))
  })

  it("refuses files that are not PNG and two files with one name", () => {
    const root = path.join(folder, "first")
    expect(() => publish({ root, files: [path.join(folder, "notes.md")], folder: "pr-1/x", scratch: folder })).toThrow(
      "is not a PNG",
    )
    expect(() => publish({ root, files: ["/a/shot.png", "/b/shot.png"], folder: "pr-1/x", scratch: folder })).toThrow(
      "two files are named shot.png",
    )
  })

  it("names the folder by pull request or branch", () => {
    expect(proofFolder({ pr: 342 })).toBe("pr-342")
    expect(proofFolder({ branch: "t3/before after" })).toBe("branch-t3-before-after")
    expect(() => proofFolder({ pr: "abc" })).toThrow("--pr takes a pull request number")
    expect(() => proofFolder({ branch: "" })).toThrow("name the pull request with --pr")
  })

  it("links a file pinned to its commit so later publishes never change it", () => {
    expect(githubRepository("git@github.com:Rickvu309/AirDesign.git")).toBe("Rickvu309/AirDesign")
    expect(githubRepository("https://github.com/Rickvu309/AirDesign")).toBe("Rickvu309/AirDesign")
    expect(() => githubRepository("/srv/git/airdesign.git")).toThrow("not a GitHub repository")
    expect(imageLink("o/r", "abc", "pr-1/run/agent empty.png")).toBe(
      "https://github.com/o/r/blob/abc/pr-1/run/agent%20empty.png?raw=true",
    )
  })
})
