import { stagedIndex, type Stage } from "./fills-conversion.js"
import { record } from "./plain-object.js"

export const overlayFormat = 71

type Loose = Record<string, unknown>

function overlayPatch(raw: unknown): unknown {
  const patch = record(raw)
  const fills = record(patch?.fills)
  if (patch === null || fills === null || !Object.hasOwn(fills, "overlay")) return raw
  if (Object.hasOwn(fills, "p3") || fills.overlay === "inherit") return null
  const moved = Object.entries(fills).map(([field, edit]) => [field === "overlay" ? "p3" : field, edit] as const)
  return { ...patch, fills: Object.fromEntries(moved) }
}

const overlayStage: Stage = { keys: {}, patch: overlayPatch, kind: (kind) => kind, opening: (opening) => opening }

export function overlayIndex(raw: Loose): Loose | null {
  return stagedIndex(raw, overlayStage)
}
