import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { caughtCount } from "./judge-proof.mjs"
import { readRun } from "./vitest-sticks.mjs"

const knownFaults = (root) => readRun(root).faults

const tests = (root) => readRun(root).tests

const realDecks = (root) => {
  const fixtures = path.join(root, "scripts/pptx-fixtures")
  const cases = JSON.parse(fs.readFileSync(path.join(fixtures, "cases.json"), "utf8"))
  const names = new Set(cases.flatMap((row) => [row.before, row.after]))
  return [...names].filter((name) => fs.statSync(path.join(fixtures, name)).size >= 100_000).length
}

const built = (root, name) => {
  const entry = path.join(root, "packages", name, "dist/index.js")
  if (!fs.existsSync(entry)) throw new Error(`packages/${name} is not built. Run pnpm build, then run this again.`)
  return import(pathToFileURL(entry).href)
}

const routeNames = (table) =>
  Object.values(table).flatMap((routes) => Object.values(routes).map((named) => named.route))

const capabilitiesExported = async (root) => {
  const document = await built(root, "document")
  const pptx = await built(root, "pptx")
  return {
    now: new Set(Object.values(pptx.writtenRoutes)).size,
    goal: new Set([...routeNames(document.properties), ...routeNames(document.structure)]).size,
  }
}

const plantedBreaks = (root) =>
  caughtCount(JSON.parse(fs.readFileSync(path.join(root, "scripts/pptx-fixtures/judge-proof.json"), "utf8")))

const measures = {
  "known faults": knownFaults,
  tests,
  "real decks in the PowerPoint check": realDecks,
  "routes pptx writes": capabilitiesExported,
  "planted breaks the judge catches": plantedBreaks,
}

export const timedSticks = {
  "check seconds": "scripts/check.mjs",
  "PowerPoint check seconds": "scripts/pptx-check.mjs",
}

const record = (root) => JSON.parse(fs.readFileSync(path.join(root, "sticks.json"), "utf8"))

export const overLimit = ({ name, now, limit }) =>
  now > limit ? `${name} is ${now} and its limit is ${limit}. Make it faster.` : undefined

export const timeStick = (root, name, started) => {
  const limit = record(root)[name]?.limit
  const now = Number(((Date.now() - started) / 1000).toFixed(1))
  if (typeof limit !== "number") throw new Error(`${name} has no limit in sticks.json.`)
  const over = overLimit({ name, now, limit })
  const gated = process.env.CI === "true" || process.env.CI === "1"
  return { line: `stick ${name}  now ${now}  limit ${limit}`, over, fails: gated && now > limit * 2 }
}

export const readSticks = async (root) => {
  const recorded = record(root)
  const rows = []
  const drift = []
  for (const [name, measure] of Object.entries(measures)) {
    const stick = recorded[name]
    if (stick === undefined) {
      drift.push(`${name} is measured and missing from sticks.json.`)
      continue
    }
    const measured = await measure(root)
    if (typeof stick.floor === "number") {
      rows.push({ name, now: measured, floor: stick.floor })
      if (measured !== stick.floor) {
        drift.push(`${name} is ${measured} and sticks.json says ${stick.floor}. Record ${measured} in sticks.json.`)
      }
      continue
    }
    const { now, goal } = typeof measured === "number" ? { now: measured, goal: stick.goal } : measured
    rows.push({ name, now, goal })
    if (now !== stick.now)
      drift.push(`${name} is ${now} and sticks.json says ${stick.now}. Record ${now} in sticks.json.`)
    if (goal !== stick.goal)
      drift.push(`${name} has goal ${goal} and sticks.json says ${stick.goal}. Record goal ${goal} in sticks.json.`)
  }
  for (const [name, runner] of Object.entries(timedSticks)) {
    const limit = recorded[name]?.limit
    if (typeof limit === "number") rows.push({ name, limit })
    else drift.push(`${name} is timed by ${runner} and has no limit in sticks.json.`)
  }
  for (const [name, stick] of Object.entries(recorded)) {
    if (name in measures || name in timedSticks) continue
    if ("limit" in stick) drift.push(`${name} has a limit in sticks.json and no runner times it.`)
    else drift.push(`${name} is in sticks.json and nothing measures it.`)
  }
  return { rows, drift }
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const { rows, drift } = await readSticks(path.resolve(path.dirname(self), "..")).catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
  const width = Math.max(...rows.map((row) => row.name.length))
  for (const row of rows) {
    if ("limit" in row) continue
    if ("floor" in row) {
      console.log(`stick ${row.name.padEnd(width)}  now ${row.now}  floor ${row.floor}`)
      continue
    }
    console.log(`stick ${row.name.padEnd(width)}  now ${row.now}  goal ${row.goal}`)
  }
  for (const line of drift) console.log(line)
  if (drift.length > 0) process.exit(1)
}
