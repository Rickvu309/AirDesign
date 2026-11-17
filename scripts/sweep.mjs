import path from "node:path"
import { fileURLToPath } from "node:url"
import { removeLeftovers } from "./leftovers.mjs"
import { bringMainUp, readPulls, removeStale, removeStaleBranches, warnStashes } from "./worktrees.mjs"

export const sweepLine =
  "sweep      pnpm sweep lists finished worktrees, branches and verify leftovers; --apply removes them"

export const sweep = ({ root, apply, say, pulls = readPulls(root), ...options }) => {
  const lines = []
  const tell = (line) => {
    lines.push(line)
    say(line)
  }
  removeStale({ root, apply, pulls, say: tell, ...options })
  removeStaleBranches({ root, apply, pulls, say: tell })
  warnStashes({ root, say })
  removeLeftovers({ apply, say: tell, ...options })
  if (apply && bringMainUp({ root })) tell("brought the main checkout up to origin/main")
  if (!apply) say(lines.length === 0 ? "nothing to sweep" : "a dry run: pnpm sweep --apply removes these")
  return lines
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const argv = process.argv.slice(2)
  const unknown = argv.filter((word) => word !== "--apply")
  if (unknown.length > 0) {
    console.error(`${unknown.join(", ")} is not a flag of pnpm sweep. usage: pnpm sweep [--apply]`)
    process.exit(1)
  }
  const onCi = process.env.CI === "true" || process.env.CI === "1"
  if (!onCi) sweep({ root: path.resolve(path.dirname(self), ".."), apply: argv.includes("--apply"), say: console.log })
}
