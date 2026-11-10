import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { missingOperations, passedWrites, scoreWrittenRoute, writtenRouteFiles } from "./pptx-route-judge.mjs"

const unproven = /\.(?:fails|skip|todo)\b|\.(?:fixme|fail)\(|\b(?:fails|skip|todo): true/g

const knownFaults = (root) => {
  const listed = spawnSync("git", ["ls-files", "-z", "*.test.*", "*.spec.*"], { cwd: root, encoding: "utf8" })
  if (listed.status !== 0) throw new Error(listed.stderr || "git ls-files failed")
  let count = 0
  for (const file of listed.stdout.split("\0")) {
    if (file === "" || file === "scripts/sticks.test.mjs" || !fs.existsSync(path.join(root, file))) continue
    count += fs.readFileSync(path.join(root, file), "utf8").match(unproven)?.length ?? 0
  }
  return count
}

const built = (root, name) => {
  const entry = path.join(root, "packages", name, "dist/index.js")
  if (!fs.existsSync(entry)) throw new Error(`packages/${name} is not built. Run pnpm build, then run this again.`)
  return import(pathToFileURL(entry).href)
}

const routeNames = (table) =>
  Object.values(table).flatMap((routes) => Object.values(routes).map((named) => named.route))

const judgedCache = new Map()

const judgeDeck = async (root) => {
  const pptx = await built(root, "pptx")
  const file = path.join(root, "scripts/pptx-fixtures/routes.pptx")
  if (!fs.existsSync(file) || typeof pptx.readParts !== "function" || typeof pptx.routeRuns !== "function") {
    return { routes: 0, decks: 0 }
  }
  if (typeof pptx.prepareMarkup === "function") {
    const require = createRequire(path.join(root, "packages/pptx/package.json"))
    await pptx.prepareMarkup(fs.readFileSync(require.resolve("sax-wasm/lib/sax-wasm.wasm")))
  }
  const original = await pptx.readParts(fs.readFileSync(file))
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-stick-"))
  try {
    const written = await writtenRouteFiles(pptx, original, directory, "stick")
    const runs = written.map((item) => ({
      route: item.run.route,
      passed: scoreWrittenRoute(pptx, original, [], item, []) === null,
    }))
    return passedWrites([
      {
        runs,
        missing:
          missingOperations(
            pptx,
            written.map((item) => item.run),
          ).length > 0,
      },
    ])
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

const judged = (root) => {
  const cached = judgedCache.get(root)
  if (cached !== undefined) return cached
  const pending = judgeDeck(root)
  judgedCache.set(root, pending)
  return pending
}

const realDecks = async (root) => (await judged(root)).decks

const capabilitiesExported = async (root) => {
  const document = await built(root, "document")
  return {
    now: (await judged(root)).routes,
    goal: new Set([...routeNames(document.properties), ...routeNames(document.structure)]).size,
  }
}

const measures = {
  "known faults": knownFaults,
  "real decks in the PowerPoint check": realDecks,
  "routes pptx writes": capabilitiesExported,
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
    console.log(`stick ${row.name.padEnd(width)}  now ${row.now}  goal ${row.goal}`)
  }
  for (const line of drift) console.log(line)
  if (drift.length > 0) process.exit(1)
}
