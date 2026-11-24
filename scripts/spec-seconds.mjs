import fs from "node:fs"
import path from "node:path"

export const specFolder = "tests/browser"
export const specSecondsName = "spec-seconds.json"

const narrowing =
  /^(-g|--grep|--grep-invert|--last-failed|--only-changed|--test-list|--test-list-invert|--shard)(=|$)|:\d+(:\d+)?$/

export const narrowedRun = (argv) => argv.some((word) => narrowing.test(word))

const recordPath = (root) => path.join(root, specFolder, specSecondsName)

export const readSpecSeconds = (root) => JSON.parse(fs.readFileSync(recordPath(root), "utf8"))

export const specFiles = (root) => {
  const folder = path.join(root, specFolder)
  return fs
    .readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".spec.ts"))
    .map((entry) => path.relative(folder, path.join(entry.parentPath, entry.name)))
    .sort()
}

const middle = (values) => {
  const sorted = values.toSorted((a, b) => a - b)
  if (sorted.length === 0) return 1
  const half = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2
}

export const unrecordedSeconds = (seconds) => {
  const unrecorded = middle(Object.values(seconds))
  return (key) => seconds[key] ?? unrecorded
}

export const weightedShares = ({ keys, seconds, total, serialKey }) => {
  const weigh = unrecordedSeconds(seconds)
  const hasSerial = keys.includes(serialKey)
  const weighed = [...new Set(keys)]
    .filter((key) => key !== serialKey)
    .map((key) => ({ key, seconds: weigh(key) }))
    .toSorted((a, b) => b.seconds - a.seconds || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  const loads = Array.from({ length: total }, () => 0)
  const shares = Array.from({ length: total }, () => [])
  if (hasSerial) {
    loads[0] = weigh(serialKey)
    shares[0].push(serialKey)
  }
  for (const { key, seconds: weight } of weighed) {
    const elapsed = loads.map((load, index) => (hasSerial && index > 0 ? load / 2 : load))
    const lightest = elapsed.indexOf(Math.min(...elapsed))
    loads[lightest] += weight
    shares[lightest].push(key)
  }
  return { shares: shares.map((share) => share.toSorted()), loads }
}

const tenths = (milliseconds) => Math.round(milliseconds / 100) / 10

const drifted = (measured, recorded) => recorded === undefined || measured > recorded * 2 || measured < recorded / 2

const refreshed = (recorded, measured) => {
  const kept = { ...recorded }
  for (const [file, seconds] of measured) if (drifted(seconds, kept[file])) kept[file] = seconds
  return kept
}

const sortedKeys = (record) => Object.fromEntries(Object.entries(record).toSorted(([a], [b]) => (a < b ? -1 : 1)))

export const measuredName = (record) => record.replace(/\.json$/, ".measured.json")

export const measuredSeconds = ({ scheduled, tests }) => {
  const files = new Map()
  for (const test of tests) {
    const file = files.get(test.file) ?? { ended: 0, kept: true, seconds: 0 }
    file.ended += 1
    file.kept &&= test.status === test.expectedStatus
    file.seconds += test.duration
    files.set(test.file, file)
  }
  const whole = [...files].filter(([name, file]) => file.kept && file.ended === scheduled.get(name))
  return {
    seconds: Object.fromEntries(whole.map(([name, file]) => [name, tenths(file.seconds)])),
  }
}

export const keepMeasured = (file, measured) => {
  const kept = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { seconds: {} }
  const merged = {
    seconds: sortedKeys({ ...kept.seconds, ...measured.seconds }),
  }
  fs.writeFileSync(file, `${JSON.stringify(merged, null, 2)}\n`)
}

export const foldedSeconds = ({ record, measured, exists }) => {
  const present = (part) => Object.fromEntries(Object.entries(part).filter(([name]) => exists(name)))
  return {
    seconds: sortedKeys(refreshed(present(record.seconds), Object.entries(measured.seconds))),
  }
}
