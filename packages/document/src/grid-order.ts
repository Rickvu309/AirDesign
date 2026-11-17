import { type SlideId } from "./element-id.js"
import { elementCommand } from "./element-order.js"
import { groupCommand } from "./element-group.js"
import { limits } from "./limits.js"
import { orderKeyBetween, type OrderKey } from "./order-key.js"
import type { SlideSpot } from "./person-undo.js"
import type { FoldedSlide, LegacySlideCommand, SlideState, SlideRefusal } from "./slide-order.js"
export { readGridCommand } from "./grid-read.js"

export type GridSide = "same" | "new"
export type GridLayout = { readonly starts: readonly SlideId[] }
export type GridRow = readonly [SlideId, ...SlideId[]]
export type SlideStep = { readonly id: SlideId; readonly before: SlideSpot; readonly after: SlideSpot }
export type HeadStep = { readonly id: SlideId; readonly before: boolean; readonly after: boolean }
export type RowGuard = { readonly head: SlideId; readonly slides: readonly [SlideId, ...SlideId[]] }
export type GridTurn = {
  readonly spots: readonly SlideStep[]
  readonly heads: readonly HeadStep[]
  readonly rows: readonly RowGuard[]
}
export type GridUndoable = {
  readonly file: readonly SlideId[]
  readonly spots: readonly SlideStep[]
  readonly heads: readonly HeadStep[]
  readonly rowsBefore: readonly RowGuard[]
  readonly rowsAfter: readonly RowGuard[]
}
export type V1Command = (
  | (Omit<Extract<LegacySlideCommand, { readonly slide: "add" }>, "key" | "runId"> & { readonly row: GridSide })
  | Omit<Extract<LegacySlideCommand, { readonly slide: "clone" }>, "key" | "runId">
  | { readonly slide: "remove"; readonly id: SlideId }
  | { readonly slide: "move"; readonly id: SlideId; readonly after: SlideId | null; readonly row: "same" }
  | { readonly slide: "grid-turn"; readonly turn: GridTurn }
) & { readonly grid: 1; readonly runId?: string }

export function defaultGrid1(ids: readonly SlideId[]): GridLayout {
  const columns = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(ids.length * 1.5))))
  return { starts: ids.filter((_, index) => index % columns === 0) }
}

export function orderedSpots(spots: readonly FoldedSlide[]): readonly FoldedSlide[] {
  return spots
    .filter((spot) => spot.present)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

function partition(ids: readonly SlideId[], starts: ReadonlySet<SlideId>): GridRow[] {
  const rows: [SlideId, ...SlideId[]][] = []
  for (const id of ids) {
    const last = rows.at(-1)
    if (last === undefined || starts.has(id)) rows.push([id])
    else last.push(id)
  }
  return rows
}

export function foldGrid(state: SlideState): {
  readonly spots: readonly FoldedSlide[]
  readonly grid: GridLayout
  readonly effects: readonly LegacySlideCommand[]
} {
  const spots = new Map<SlideId, FoldedSlide>()
  let previous: OrderKey | null = null
  for (const id of state.file) {
    const key = orderKeyBetween(previous, null)
    spots.set(id, { id, key, birth: { from: "file" }, present: true })
    previous = key
  }
  let heads = new Set<SlideId>()
  let initialized = false
  const effects: LegacySlideCommand[] = []
  const present = () => orderedSpots([...spots.values()])
  for (const command of state.order) {
    if (elementCommand(command) || groupCommand(command)) {
      effects.push(command)
      continue
    }
    const before = present()
    if (!initialized && command.grid === 1) {
      heads = new Set(defaultGrid1(before.map((spot) => spot.id)).starts)
      initialized = true
    }
    if (command.slide === "grid-turn") {
      for (const step of command.turn.spots) {
        if (step.before.present === step.after.present && step.before.key === step.after.key) continue
        const spot = spots.get(step.id)
        if (spot !== undefined) spots.set(step.id, { ...spot, ...step.after })
        if (step.before.present && !step.after.present) effects.push({ slide: "remove", id: step.id })
        else if (!step.before.present && step.after.present)
          effects.push({ slide: "restore", id: step.id, key: step.after.key })
        else effects.push({ slide: "move", id: step.id, key: step.after.key })
      }
      for (const step of command.turn.heads) {
        if (step.after) heads.add(step.id)
        else heads.delete(step.id)
      }
    } else {
      const sourceRows = partition(
        before.map((spot) => spot.id),
        heads,
      )
      if (initialized && (command.slide === "remove" || command.slide === "move")) {
        const row = sourceRows.find((row) => row.includes(command.id))
        if (row?.[0] === command.id) {
          heads.delete(command.id)
          if (row[1] !== undefined) heads.add(row[1])
        }
      }
      const remaining = before.filter((spot) => command.slide !== "move" || spot.id !== command.id)
      const anchor =
        command.slide === "add"
          ? command.grid === 1 && command.row === "new"
            ? sourceRows.find((row) => row.includes(command.after))?.at(-1)
            : command.after
          : command.slide === "clone"
            ? command.source
            : command.slide === "move" && command.grid === 1
              ? command.after
              : undefined
      const at = anchor === null ? -1 : remaining.findIndex((spot) => spot.id === anchor)
      const key =
        "key" in command
          ? command.key
          : command.slide === "remove"
            ? null
            : orderKeyBetween(remaining[at]?.key ?? null, remaining[at + 1]?.key ?? null)
      if (command.slide === "add" || command.slide === "clone") {
        if (key === null) throw new Error("slide")
        const birth =
          command.slide === "clone"
            ? { from: "clone" as const, source: command.source }
            : command.layoutPart === undefined
              ? { from: "blank" as const, layout: command.layout }
              : { from: "blank" as const, layout: command.layout, layoutPart: command.layoutPart }
        spots.set(command.id, { id: command.id, key, birth, present: true })
        if (command.slide === "add" && command.grid === 1 && command.row === "new") heads.add(command.id)
        if (command.slide === "add")
          effects.push({
            slide: "add",
            id: command.id,
            after: anchor ?? command.after,
            layout: command.layout,
            key,
            ...(command.layoutPart === undefined ? {} : { layoutPart: command.layoutPart }),
            ...(command.floor === undefined ? {} : { floor: command.floor }),
            ...(command.runId === undefined ? {} : { runId: command.runId }),
          })
        else
          effects.push({
            slide: "clone",
            id: command.id,
            source: command.source,
            key,
            ...(command.floor === undefined ? {} : { floor: command.floor }),
            ...(command.runId === undefined ? {} : { runId: command.runId }),
          })
      } else {
        const spot = spots.get(command.id)
        if (spot === undefined) throw new Error("slide")
        spots.set(command.id, { ...spot, ...(key === null ? {} : { key }), present: command.slide !== "remove" })
        if (command.slide === "remove")
          effects.push({
            slide: "remove",
            id: command.id,
            ...(command.runId === undefined ? {} : { runId: command.runId }),
          })
        else if (key !== null)
          effects.push({
            slide: command.slide,
            id: command.id,
            key,
            ...(command.runId === undefined ? {} : { runId: command.runId }),
          })
      }
      if (initialized && command.slide !== "remove") {
        const now = present()
        const index = now.findIndex((spot) => spot.id === command.id)
        if (index === 0) {
          const next = now[1]
          if (next !== undefined) heads.delete(next.id)
          heads.add(command.id)
        }
      }
    }
    if (initialized) {
      const ids = new Set(present().map((spot) => spot.id))
      heads = new Set([...heads].filter((id) => ids.has(id)))
      const first = present()[0]
      if (first !== undefined) heads.add(first.id)
    }
  }
  const ids = present().map((spot) => spot.id)
  return {
    spots: [...spots.values()],
    grid: initialized ? { starts: ids.filter((id) => heads.has(id)) } : defaultGrid1(ids),
    effects,
  }
}

export function gridRows(state: SlideState): readonly GridRow[] {
  const folded = foldGrid(state)
  return partition(
    orderedSpots(folded.spots).map((spot) => spot.id),
    new Set(folded.grid.starts),
  )
}

function sits(now: FoldedSlide | undefined, expected: SlideSpot): boolean {
  return (now?.present ?? false) === expected.present && (!expected.present || now?.key === expected.key)
}

export function turnRefusal(state: SlideState, turn: GridTurn): SlideRefusal | null {
  const folded = foldGrid(state)
  const spots = new Map(folded.spots.map((spot) => [spot.id, spot]))
  const heads = new Set(folded.grid.starts)
  if (turn.heads.some((step) => !turn.spots.some((spot) => spot.id === step.id))) return "stale"
  if (turn.spots.some((step) => !spots.has(step.id) || !sits(spots.get(step.id), step.before))) return "stale"
  if (turn.heads.some((step) => heads.has(step.id) !== step.before)) return "stale"
  const rows = gridRows(state)
  if (
    turn.rows.some(
      (guard) => !rows.some((row) => row[0] === guard.head && JSON.stringify(row) === JSON.stringify(guard.slides)),
    )
  )
    return "stale"
  for (const step of turn.spots) {
    const spot = spots.get(step.id)
    if (spot !== undefined) spots.set(step.id, { ...spot, ...step.after })
  }
  const present = orderedSpots([...spots.values()])
  if (present.length === 0) return "dead"
  if (present.length > limits.slides) return "limit"
  for (const step of turn.heads) {
    if (step.after) heads.add(step.id)
    else heads.delete(step.id)
  }
  if ([...heads].some((id) => !present.some((spot) => spot.id === id))) return "stale"
  const first = present[0]
  if (first !== undefined) heads.add(first.id)
  const afterRows = partition(
    present.map((spot) => spot.id),
    heads,
  )
  const owner = new Map(afterRows.flatMap((row) => row.map((id) => [id, row[0]] as const)))
  const guarded = new Set(turn.spots.map((step) => step.id))
  const staying = new Set(
    turn.spots
      .filter((step) => step.before.present && step.after.present && step.before.key === step.after.key)
      .map((step) => step.id),
  )
  for (const row of rows) {
    for (const id of row) {
      const next = owner.get(id)
      if (guarded.has(id) || next === undefined || next === row[0]) continue
      if (!row.some((witness) => staying.has(witness) && owner.get(witness) === next)) return "stale"
    }
  }
  return null
}
