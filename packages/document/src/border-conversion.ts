import { record } from "./plain-object.js"
import { stagedIndex, type Renames, type Stage } from "./fills-conversion.js"

export const borderFormat = 64

const alias = "line"
const trait = "border"

type Loose = Record<string, unknown>

const borderKeys: Renames = Object.fromEntries(
  ["width", "fill", "dash", "head", "tail"].map((field) => [`${alias}.${field}`, `${trait}.${field}`]),
)

function borderPatch(raw: unknown): unknown {
  const patch = record(raw)
  if (patch === null || !Object.hasOwn(patch, alias)) return raw
  if (Object.hasOwn(patch, trait)) return null
  return Object.fromEntries(Object.entries(patch).map(([key, fields]) => [key === alias ? trait : key, fields]))
}

const borderStage: Stage = {
  keys: borderKeys,
  patch: borderPatch,
  kind: (kind) => kind,
  opening: (opening) => opening,
}

export function borderIndex(raw: Loose): Loose | null {
  return stagedIndex(raw, borderStage)
}
