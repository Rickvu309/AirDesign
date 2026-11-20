import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { knowsMain, uncheckedPushes } from "./checked.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pushed = fs.readFileSync(0, "utf8")
const unchecked = uncheckedPushes(root, pushed)
const refused = knowsMain(root)
  ? [
      ...(await import("./commit-authors.mjs")).pushRefusals(root, pushed),
      ...(await import("./linear-branch.mjs")).pushFaults(root, pushed),
    ]
  : []
for (const line of refused) console.error(line)
if (unchecked.length > 0) {
  for (const { ref, commit } of unchecked) {
    console.error(`push refused: no gate passed on ${ref} at ${commit.slice(0, 8)}.`)
  }
  console.error(
    "Run pnpm land: it runs the gate on exactly what you commit, stamps the commit, pushes it and follows ci. pnpm land --check stops after the stamp, and pnpm gate runs the gate on what you have not committed yet.",
  )
  process.exit(1)
}
if (refused.length > 0) process.exit(1)
