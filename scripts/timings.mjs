import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { journeyFolder, journeyNameOf, journeySecondsName } from "../tests/journeys/journey-shards.mjs"
import { knowsMain } from "./checked.mjs"
import { foldedSeconds, measuredName, specFolder, specSecondsName } from "./spec-seconds.mjs"
import { unitSecondsFile } from "./unit-test-files.mjs"

export const timingsCommand = "pnpm timings"

const journeyNames = (root) => {
  const folder = path.join(root, journeyFolder)
  return fs.existsSync(folder) ? fs.readdirSync(folder).map(journeyNameOf).filter(Boolean) : []
}

export const timingRecords = [
  {
    record: `${specFolder}/${specSecondsName}`,
    flat: false,
    exists: (root) => (name) => fs.existsSync(path.join(root, specFolder, name)),
  },
  {
    record: unitSecondsFile,
    flat: true,
    exists: (root) => (name) => fs.existsSync(path.join(root, name)),
  },
  {
    record: `tests/journeys/${journeySecondsName}`,
    flat: true,
    exists: (root) => {
      const names = journeyNames(root)
      return (name) => names.includes(name)
    },
  },
]

const recordFiles = timingRecords.map(({ record }) => record)

export const foldTimings = (root) =>
  timingRecords.flatMap(({ record, flat, exists }) => {
    const measuredFile = path.join(root, measuredName(record))
    const recordFile = path.join(root, record)
    if (!fs.existsSync(measuredFile) || !fs.existsSync(recordFile)) return []
    const before = fs.readFileSync(recordFile, "utf8")
    const kept = JSON.parse(before)
    const folded = foldedSeconds({
      record: flat ? { seconds: kept } : kept,
      measured: JSON.parse(fs.readFileSync(measuredFile, "utf8")),
      exists: exists(root),
    })
    const after = `${JSON.stringify(flat ? folded.seconds : folded, null, 2)}\n`
    if (after !== before) fs.writeFileSync(recordFile, after)
    fs.rmSync(measuredFile)
    return [{ record, changed: after !== before }]
  })

export const timingRefusals = (paths) => {
  const records = paths.filter((file) => recordFiles.includes(file))
  if (records.length === paths.length) return []
  return records.map(
    (record) =>
      `${record} changed beside other files. A local test run measures into ${measuredName(record)}, and only \`${timingsCommand}\` writes ${record}, in a pull request that changes nothing else. Put it back with: git checkout origin/main -- ${record}`,
  )
}

export const changedPaths = (root) => {
  const git = (args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  const base = git(["merge-base", "origin/main", "HEAD"])
  return git(["diff", "--name-only", base]).split("\n").filter(Boolean)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  if (process.argv.includes("--check")) {
    if (!knowsMain(root)) {
      console.error("origin/main is missing, so the timing records cannot be judged. Run git fetch origin main.")
      process.exit(1)
    }
    const refused = timingRefusals(changedPaths(root))
    for (const line of refused) console.error(line)
    if (refused.length > 0) process.exit(1)
    console.log("timings: no timing record changed beside other files")
  } else {
    const folded = foldTimings(root)
    if (folded.length === 0)
      console.log(
        `Nothing measured yet. A whole passing local run of pnpm test:browser, pnpm test:unit or pnpm test:journeys measures into ${recordFiles.map(measuredName).join(", ")}.`,
      )
    for (const { record, changed } of folded)
      console.log(`${record}: ${changed ? "rewritten" : "unchanged, every measure is within half and double"}`)
    if (folded.some(({ changed }) => changed))
      console.log("Commit these files alone and open a pull request that changes nothing else.")
  }
}
