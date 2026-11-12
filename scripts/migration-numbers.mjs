import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const recordFile = "apps/api/src/frozen-migrations.json"

export const takenNumbers = ({ base, head }) => {
  const onBase = new Map(base.map((entry) => [entry.id, entry.sha256]))
  return head
    .filter((entry) => onBase.has(entry.id) && onBase.get(entry.id) !== entry.sha256)
    .map((entry) => entry.id)
    .sort((left, right) => left - right)
}

export const migrationFault = ({ base, head }) => {
  if (base === undefined || head === undefined) return undefined
  const taken = takenNumbers({ base, head })
  if (taken.length === 0) return undefined
  const free = Math.max(...base.map((entry) => entry.id), ...head.map((entry) => entry.id)) + 1
  return `Migration ${taken[0]} is already on origin/main with different sql. Give yours the next free number, ${free}: rebase on origin/main, change its id to ${free} in apps/api/src/migrations.ts, then run node scripts/frozen-migrations.mjs to record it.`
}

const recordAt = (root, revision) => {
  try {
    return JSON.parse(
      execFileSync("git", ["-C", root, "show", `${revision}:${recordFile}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    )
  } catch {
    return undefined
  }
}

export const migrationFaultAt = (root) =>
  migrationFault({ base: recordAt(root, "origin/main"), head: recordAt(root, "HEAD") })

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const fault = migrationFaultAt(path.resolve(path.dirname(self), ".."))
  if (fault !== undefined) {
    console.error(fault)
    process.exit(1)
  }
}
