import { readSlideId, type SlideId } from "./element-id.js"
import { readOrderKey } from "./order-key.js"
import { readSlideState } from "./slide-order.js"
import { readFloor } from "./slide-floor.js"
import type { GridCopy, GridTurn, HeadStep, RowGuard, SlideStep, V1Command } from "./grid-order.js"
import type { SlideSpot } from "./person-undo.js"
import { limits } from "./limits.js"

function spot(raw: unknown): SlideSpot | undefined {
  if (typeof raw !== "object" || raw === null || !("present" in raw) || !("key" in raw)) return undefined
  const key = readOrderKey(raw.key)
  return key === undefined || typeof raw.present !== "boolean" ? undefined : { present: raw.present, key }
}

function turn(raw: unknown): GridTurn | undefined {
  if (typeof raw !== "object" || raw === null || !("spots" in raw) || !("heads" in raw) || !("rows" in raw))
    return undefined
  if (!Array.isArray(raw.spots) || !Array.isArray(raw.heads) || !Array.isArray(raw.rows)) return undefined
  if (Math.max(raw.spots.length, raw.heads.length, raw.rows.length) > limits.slides) return undefined
  const spots: SlideStep[] = []
  const heads: HeadStep[] = []
  const rows: RowGuard[] = []
  for (const step of raw.spots) {
    if (typeof step !== "object" || step === null) return undefined
    const id = readSlideId(step.id)
    const before = spot(step.before),
      after = spot(step.after)
    if (id === undefined || before === undefined || after === undefined) return undefined
    spots.push({ id, before, after })
  }
  for (const step of raw.heads) {
    if (typeof step !== "object" || step === null) return undefined
    const id = readSlideId(step.id)
    if (id === undefined || typeof step.before !== "boolean" || typeof step.after !== "boolean") return undefined
    heads.push({ id, before: step.before, after: step.after })
  }
  for (const row of raw.rows) {
    if (typeof row !== "object" || row === null || !Array.isArray(row.slides)) return undefined
    const head = readSlideId(row.head)
    const slides: (import("./element-id.js").SlideId | undefined)[] = row.slides.map((id: unknown) => readSlideId(id))
    const first = slides[0]
    if (head === undefined || first === undefined || head !== first || slides.length > limits.slides) return undefined
    const rest = slides.slice(1).filter((id): id is NonNullable<typeof id> => id !== undefined)
    if (rest.length !== slides.length - 1 || new Set(slides).size !== slides.length) return undefined
    rows.push({ head, slides: [first, ...rest] })
  }
  if (
    new Set(spots.map((step) => step.id)).size !== spots.length ||
    new Set(heads.map((step) => step.id)).size !== heads.length
  )
    return undefined
  return { spots, heads, rows }
}

function uniqueIds(raw: unknown): readonly [SlideId, ...SlideId[]] | undefined {
  if (!Array.isArray(raw) || raw.length > limits.slides) return undefined
  const ids: SlideId[] = []
  for (const item of raw) {
    const id = readSlideId(item)
    if (id === undefined) return undefined
    ids.push(id)
  }
  const [first, ...rest] = ids
  return first === undefined || new Set(ids).size !== ids.length ? undefined : [first, ...rest]
}

function readCopies(raw: unknown): readonly [GridCopy, ...GridCopy[]] | undefined {
  if (!Array.isArray(raw) || raw.length > limits.slides) return undefined
  const copies: GridCopy[] = []
  for (const item of raw) {
    if (
      typeof item !== "object" ||
      item === null ||
      Object.keys(item).some((key) => key !== "id" && key !== "source" && key !== "floor")
    )
      return undefined
    const id = readSlideId(item.id)
    const source = readSlideId(item.source)
    if (id === undefined || source === undefined) return undefined
    const floor = Object.hasOwn(item, "floor") ? readFloor(item.floor, id) : null
    if (floor === undefined) return undefined
    copies.push({ id, source, ...(floor === null ? {} : { floor }) })
  }
  const [first, ...rest] = copies
  if (
    first === undefined ||
    new Set(copies.map((copy) => copy.id)).size !== copies.length ||
    new Set(copies.map((copy) => copy.source)).size !== copies.length
  )
    return undefined
  return [first, ...rest]
}

export function readGridCommand(raw: Record<string, unknown>): V1Command | undefined {
  if (raw.grid !== 1) return undefined
  const fields =
    raw.slide === "remove-many"
      ? ["ids"]
      : raw.slide === "clone-many"
        ? ["copies"]
        : raw.slide === "move-many"
          ? ["ids", "after", "row"]
          : raw.slide === "grid-turn"
            ? ["turn"]
            : raw.slide === "remove"
              ? ["id"]
              : raw.slide === "move"
                ? ["id", "after", "row"]
                : raw.slide === "clone"
                  ? ["id", "source", "floor"]
                  : raw.slide === "add"
                    ? ["id", "after", "layout", "layoutPart", "floor", "row"]
                    : []
  if (Object.keys(raw).some((key) => !["slide", "grid", "runId", "file", ...fields].includes(key))) return undefined
  if (raw.slide === "grid-turn") {
    const parsed = turn(raw.turn)
    return parsed === undefined ? undefined : { slide: "grid-turn", grid: 1, turn: parsed }
  }
  if (raw.slide === "remove-many") {
    const ids = uniqueIds(raw.ids)
    return ids === undefined ? undefined : { slide: "remove-many", grid: 1, ids }
  }
  if (raw.slide === "clone-many") {
    const copies = readCopies(raw.copies)
    return copies === undefined ? undefined : { slide: "clone-many", grid: 1, copies }
  }
  if (raw.slide === "move-many") {
    const ids = uniqueIds(raw.ids)
    const after = raw.after === null ? null : readSlideId(raw.after)
    if (ids === undefined || after === undefined) return undefined
    if (raw.row !== "same" && raw.row !== "new" && raw.row !== "keep") return undefined
    return { slide: "move-many", grid: 1, ids, after, row: raw.row }
  }
  const id = readSlideId(raw.id)
  if (id === undefined) return undefined
  if (raw.slide === "remove") return { slide: "remove", id, grid: 1 }
  if (raw.slide === "move") {
    const after = raw.after === null ? null : readSlideId(raw.after)
    return after === undefined || raw.row !== "same" ? undefined : { slide: "move", id, after, row: "same", grid: 1 }
  }
  if (raw.slide !== "add" && raw.slide !== "clone") return undefined
  if (raw.slide === "add" && raw.row !== "same" && raw.row !== "new") return undefined
  const parsed = readSlideState({ file: [], order: [{ ...raw, grid: undefined, key: "a0" }] })?.order[0]
  if (parsed?.slide === "add" && parsed.grid === undefined) {
    const { key: _key, ...birth } = parsed
    if (raw.row !== "same" && raw.row !== "new") return undefined
    return { ...birth, row: raw.row, grid: 1 }
  }
  if (parsed?.slide === "clone" && parsed.grid === undefined) {
    const { key: _key, ...birth } = parsed
    return { ...birth, grid: 1 }
  }
  return undefined
}
