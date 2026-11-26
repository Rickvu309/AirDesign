import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { attributionLine } from "../../../../scripts/commit-authors.mjs"

function ghIn(args, options = {}) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 1 << 26,
    ...options,
  }).trim()
}

export function commentBody(markdown) {
  const text = String(markdown ?? "")
  if (text.trim() === "") throw new Error("refuses an empty file: comment has no content")
  const attribution = attributionLine(text)
  if (attribution !== undefined)
    throw new Error(`refuses the comment: it has the attribution line "${attribution}". Delete that line.`)
  return text
}

export function comment({ pr, file, runGh = ghIn }) {
  if (pr === undefined || !/^\d+$/.test(String(pr)))
    throw new Error(`comment takes a pull request number, not ${String(pr)}`)
  if (!file || !existsSync(file)) throw new Error(`name a markdown file to post; ${String(file)} does not exist`)
  const content = readFileSync(file, "utf8")
  const body = commentBody(content)
  const url = runGh(["pr", "comment", String(pr), "--body", body])
  return { pr: Number(pr), url }
}
