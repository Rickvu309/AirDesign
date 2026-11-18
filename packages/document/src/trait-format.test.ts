import { expect, it } from "vitest"
import { format, stamps } from "./format.js"
import { traitNames, traits, type TraitName } from "./traits.js"

const recorded: Readonly<Record<TraitName, readonly string[]>> = {
  link: ["5465b825", "58c5d32c"],
  identity: ["5465b825", "5ca2d09f"],
  box: ["f180e7a7", "4f9a7811"],
  geometry: ["5465b825", "bd526818"],
  fills: [
    "5465b825",
    "5b43a296",
    "7ae321c1",
    "a06873f9",
    "2fde11a7",
    "5465b825",
    "ceff7e39",
    "0d6da2f2",
    "25674b97",
    "31699927",
    "5465b825",
    "3c06b041",
    "8542c018",
    "1d69c93e",
  ],
  border: ["5465b825", "118c2fdf", "db2c2c2c", "db2c2c2c"],
  effects: ["5465b825", "20b46c0f", "8899ef6e"],
  body: ["5465b825", "fbdbb36e"],
  text: ["7bd8d0c1", "aaea7ede", "aaea7ede", "aaea7ede", "aaea7ede", "aaea7ede", "aaea7ede"],
  connection: ["5465b825", "4ad8435a"],
  table: ["248ba3f0", "248ba3f0"],
  notes: ["d772d0d9"],
  show: ["5465b825", "fc0e1303"],
  templateStyle: ["5465b825", "fd31b1bd", "3c85bab0", "fca050fd", "9fd0fc46", "facd0a47"],
  transition: ["b27cd785"],
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
  )
}

function shapeOf(name: TraitName): string {
  const descs = Object.fromEntries(Object.entries(traits[name].fields).map(([field, kind]) => [field, kind.desc]))
  let hash = 0x811c9dc5
  for (const unit of JSON.stringify(canonical(descs))) {
    hash = Math.imul(hash ^ unit.charCodeAt(0), 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

it("stamps every trait with the shape of its fields, so a changed field names the version to write", () => {
  const stale = traitNames.flatMap((name) => {
    const { version, shape } = traits[name].stamp
    const now = shapeOf(name)
    if (shape === now) return []
    return [`${name}: its fields changed. Write { version: ${String(version + 1)}, shape: "${now}" }`]
  })
  expect(stale).toEqual([])
})

it("keeps every shape a trait ever had, one per version, so a shape never changes without its version", () => {
  const unrecorded = traitNames.flatMap((name) => {
    const { version, shape } = traits[name].stamp
    const kept = recorded[name]
    if (kept.length === version + 1 && kept[version] === shape) return []
    return [`${name}: add "${shape}" as version ${String(version)} and keep every earlier shape`]
  })
  expect(unrecorded).toEqual([])
})

it("counts every trait's version in the format", () => {
  const versions = traitNames.reduce((sum, name) => sum + traits[name].stamp.version, 0)
  expect(format).toBe(1 + stamps.row + stamps.index + stamps.command + versions)
  for (const name of traitNames) {
    expect(Number.isSafeInteger(traits[name].stamp.version)).toBe(true)
    expect(traits[name].stamp.version).toBeGreaterThanOrEqual(0)
  }
})
