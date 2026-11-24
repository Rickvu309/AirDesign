import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { removeLeftovers } from "./leftovers.mjs"
import { bringMainUp, readPulls, removeForPull, removeStale, removeStaleBranches, warnStashes } from "./worktrees.mjs"

export const sweepPull = (options) => removeForPull(options)

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

const listingFlag = "--at-most-every="

export const listingMinutes = (argv) => {
  const given = argv.find((word) => word.startsWith(listingFlag))
  if (given === undefined) return undefined
  const minutes = Number(given.slice(listingFlag.length))
  if (!(minutes > 0)) throw new Error(`${listingFlag}<minutes> takes a number of minutes above 0`)
  return minutes
}

export const listedRecently = ({ stamp, now, minutes }) => {
  try {
    return now - fs.statSync(stamp).mtimeMs < minutes * 60_000
  } catch {
    return false
  }
}

const listedStamp = path.join(os.homedir(), ".cache", "airdesign", "sweep-listed")

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const argv = process.argv.slice(2)
  const unknown = argv.filter((word) => word !== "--apply" && !word.startsWith(listingFlag))
  if (unknown.length > 0) {
    console.error(`${unknown.join(", ")} is not a flag of pnpm sweep. usage: pnpm sweep [--apply]`)
    process.exit(1)
  }
  const apply = argv.includes("--apply")
  const minutes = listingMinutes(argv)
  const onCi = process.env.CI === "true" || process.env.CI === "1"
  if (!onCi && !apply && minutes !== undefined && listedRecently({ stamp: listedStamp, now: Date.now(), minutes }))
    console.log(`sweep      listed within the last ${String(minutes)} minutes on this machine; pnpm sweep lists again`)
  else if (!onCi) {
    if (minutes !== undefined) {
      fs.mkdirSync(path.dirname(listedStamp), { recursive: true })
      fs.writeFileSync(listedStamp, "")
    }
    sweep({ root: path.resolve(path.dirname(self), ".."), apply, say: console.log })
  }
}
