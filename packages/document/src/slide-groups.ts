import type { SlideId } from "./element-id.js"
import { foldGrid, orderedSpots } from "./grid-order.js"
import { partition } from "./slide-group-keys.js"
import type { SlideState } from "./slide-order.js"

export type SlideGroup = {
  readonly key: string
  readonly slides: readonly [SlideId, ...SlideId[]]
  readonly name?: string
}

export function slideGroups(state: SlideState, names: readonly string[] = []): readonly SlideGroup[] {
  const folded = foldGrid(state, 3)
  const keys = new Map(folded.grid.starts.map((id, number) => [id, folded.grid.keys?.[number] ?? `r${id}`]))
  const ids = orderedSpots(folded.spots).map((spot) => spot.id)
  return partition(ids, new Set(folded.grid.starts)).map((slides) => {
    const key = keys.get(slides[0]) ?? `r${slides[0]}`
    const name = /^f\d+$/.test(key) ? names[Number(key.slice(1))] : undefined
    return name === undefined || name === "" ? { key, slides } : { key, slides, name }
  })
}
