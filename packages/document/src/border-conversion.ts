import { record } from "./plain-object.js"
import { stagedElement, stagedIndex, stamped, type Renames, type Stage } from "./fills-conversion.js"

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

export function borderRow(raw: Loose): unknown {
  return stamped(raw, borderPatch(raw.patch), borderFormat)
}

export function borderElement(raw: unknown): unknown {
  return stagedElement(raw, borderStage)
}

export function borderIndex(raw: Loose): Loose | null {
  return stagedIndex(raw, borderStage)
}

export function borderRegister(raw: Loose): unknown {
  const index = record(raw.index)
  if (index === null) return raw
  const converted = borderIndex(index)
  return converted === null ? null : { ...raw, index: converted }
}

export function holdsBorder(raw: unknown): boolean {
  const element = record(raw)
  return (
    Object.keys(record(element?.design) ?? {}).some((key) => key.startsWith(`${trait}.`)) ||
    record(element?.opening)?.[trait] !== undefined
  )
}
