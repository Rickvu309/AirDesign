import { applyEdit } from "./apply-edit.js"
import { type Doom, emptyDoom } from "./doom.js"
import { readLanded } from "./fold-json.js"
import { isRefusal } from "./refusal.js"

export function replayLog(rows: readonly unknown[], from: Doom = emptyDoom): Doom | undefined {
  let fold = from
  for (const row of rows) {
    const landed = readLanded(row, fold)
    if (isRefusal(landed)) return undefined
    const next = applyEdit(fold, landed)
    if (isRefusal(next)) return undefined
    fold = next
  }
  return fold
}
