import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

export const agentOwner = "Quan Vu"
export const agentHeader = `🤖 **AI Agent responding on behalf of ${agentOwner}**`

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
  return `${agentHeader}\n\n${text}`
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
