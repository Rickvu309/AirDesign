import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { filesWithMarkers, hasMarkers } from "./conflict-markers.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const mine = "<".repeat(7)
const theirs = ">".repeat(7)
const divider = "=".repeat(7)
const conflicted = `const a = 1\n${mine} HEAD\nconst b = 2\n${divider}\nconst b = 3\n${theirs} 1a2b3c4 (Move the title)\n`

same("a file the rebase left in conflict has markers", hasMarkers(conflicted), true)
same("a file with only the opening line has markers", hasMarkers(`${mine} HEAD\nx\n`), true)
same("a file with only the closing line has markers", hasMarkers(`x\n${theirs} abc123 (title)\n`), true)
same("a divider alone is a heading underline, not a conflict", hasMarkers(`Title\n${divider}\ntext\n`), false)
same("markers inside a line are not markers", hasMarkers(`const marker = "${mine} HEAD"\n`), false)
same("clean text has none", hasMarkers("const a = 1\n"), false)

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "markers-"))
process.on("exit", () => fs.rmSync(folder, { recursive: true, force: true }))
const git = (...args) =>
  execFileSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.com", ...args], {
    cwd: folder,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
const runner = (args) => ({ status: 0, stdout: git(...args), stderr: "" })
const grepRunner = (args) => {
  try {
    return runner(args)
  } catch (error) {
    return { status: error.status, stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? "") }
  }
}

git("init", "-q", "-b", "main")
fs.writeFileSync(path.join(folder, "clean.ts"), "export const a = 1\n")
fs.writeFileSync(path.join(folder, "rebased.ts"), conflicted)
git("add", "-A")
git("commit", "-q", "-m", "a rebase that kept its markers")
same("a committed file with markers is named", filesWithMarkers(grepRunner), ["rebased.ts"])

fs.writeFileSync(path.join(folder, "rebased.ts"), "export const b = 2\n")
git("add", "-A")
git("commit", "-q", "-m", "resolved")
same("a resolved file is not named", filesWithMarkers(grepRunner), [])
