import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const unproven = /\.(?:fails|skip|todo)\b|\b(?:fails|skip|todo): true/g

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

const realDecks = (root) => {
  const fixtures = path.join(root, "scripts/pptx-fixtures")
  const cases = JSON.parse(fs.readFileSync(path.join(fixtures, "cases.json"), "utf8"))
  const names = new Set(cases.flatMap((row) => [row.before, row.after]))
  return [...names].filter((name) => fs.statSync(path.join(fixtures, name)).size >= 100_000).length
}

const measures = {
  "known faults": knownFaults,
  "real decks in the PowerPoint check": realDecks,
}

export const readSticks = (root) => {
  const recorded = JSON.parse(fs.readFileSync(path.join(root, "sticks.json"), "utf8"))
  const rows = []
  const drift = []
  for (const [name, measure] of Object.entries(measures)) {
    const stick = recorded[name]
    if (stick === undefined) {
      drift.push(`${name} is measured and missing from sticks.json.`)
      continue
    }
    const now = measure(root)
    rows.push({ name, now, goal: stick.goal })
    if (now !== stick.now)
      drift.push(`${name} is ${now} and sticks.json says ${stick.now}. Record ${now} in sticks.json.`)
  }
  for (const name of Object.keys(recorded)) {
    if (!(name in measures)) drift.push(`${name} is in sticks.json and nothing measures it.`)
  }
  return { rows, drift }
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const { rows, drift } = readSticks(path.resolve(path.dirname(self), ".."))
  const width = Math.max(...rows.map((row) => row.name.length))
  for (const row of rows) console.log(`stick ${row.name.padEnd(width)}  now ${row.now}  goal ${row.goal}`)
  for (const line of drift) console.log(line)
  if (drift.length > 0) process.exit(1)
}
