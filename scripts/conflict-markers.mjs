import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const opening = /^<{7}(?: |$)/m
const closing = /^>{7}(?: |$)/m

export const hasMarkers = (text) => opening.test(text) || closing.test(text)

const lineStart = "^(<{7}|>{7})( |$)"

export const filesWithMarkers = (git) => {
  const found = git(["grep", "-l", "-I", "-E", lineStart, "HEAD", "--"])
  if (found.status === 1) return []
  if (found.status !== 0) throw new Error(`git grep could not read the commit: ${found.stderr.trim()}`)
  return found.stdout
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => line.replace(/^HEAD:/, ""))
    .filter((file) => hasMarkers(git(["show", `HEAD:${file}`]).stdout))
}

export const markerFault = (files) =>
  files.length === 0
    ? undefined
    : `a conflict marker is committed in ${files.join(", ")}. Open each file, keep what both sides meant, delete the lines that start with seven < , = or > characters, amend the commit, and run pnpm check again.`

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const git = (args) => {
    try {
      return {
        status: 0,
        stdout: execFileSync("git", args, {
          encoding: "utf8",
          maxBuffer: 256 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"],
        }),
        stderr: "",
      }
    } catch (error) {
      return { status: error.status ?? 1, stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? "") }
    }
  }
  const fault = markerFault(filesWithMarkers(git))
  if (fault !== undefined) {
    console.error(fault)
    process.exit(1)
  }
}
