import { indexedSectionStarts } from "./deck-index.js"
import { sectionRuns } from "./section-order.js"
import { type SlideId } from "./element-id.js"
import { elementCommand } from "./element-order.js"
import { groupCommand } from "./element-group.js"
import { changeSet } from "./grid-set.js"
import { moveGroup } from "./grid-move.js"
import { orderKeyBetween, type OrderKey } from "@airdesign/doom"
import { mappedSlideGroups, openingTags, partition, retag, sectionsOf, type HeadTag } from "./slide-group-keys.js"
import type { FoldedSlide, LegacySlideCommand, SlideState } from "./slide-order.js"

type SlideSpot = { readonly present: boolean; readonly key: OrderKey }

export type GridSide = "same" | "new"
export type GridLayout = { readonly starts: readonly SlideId[]; readonly keys?: readonly string[] }
export type GridGroup = readonly [SlideId, ...SlideId[]]
export type SlideStep = { readonly id: SlideId; readonly before: SlideSpot; readonly after: SlideSpot }
export type HeadStep = { readonly id: SlideId; readonly before: boolean; readonly after: boolean }
export type GroupGuard = { readonly head: SlideId; readonly slides: readonly [SlideId, ...SlideId[]] }
export type GridTurn = {
  readonly spots: readonly SlideStep[]
  readonly heads: readonly HeadStep[]
  readonly rows: readonly GroupGuard[]
}
export type GridCopy = Omit<Extract<LegacySlideCommand, { readonly slide: "clone" }>, "slide" | "key" | "runId">

export type GridVersion = 1 | 2 | 3

export type GridCommand = (
  | (Omit<Extract<LegacySlideCommand, { readonly slide: "add" }>, "key" | "runId"> & { readonly row: GridSide })
  | Omit<Extract<LegacySlideCommand, { readonly slide: "clone" }>, "key" | "runId">
  | { readonly slide: "remove"; readonly id: SlideId }
  | { readonly slide: "remove-many"; readonly ids: readonly [SlideId, ...SlideId[]] }
  | { readonly slide: "clone-many"; readonly copies: readonly [GridCopy, ...GridCopy[]] }
  | { readonly slide: "move"; readonly id: SlideId; readonly after: SlideId | null; readonly row: "same" }
  | ({
      readonly slide: "move-many"
      readonly ids: readonly [SlideId, ...SlideId[]]
    } & (
      | { readonly after: SlideId | null; readonly row: GridSide | "keep" }
      | { readonly before: SlideId; readonly row: "before" }
    ))
  | { readonly slide: "grid-turn"; readonly turn: GridTurn }
) & { readonly grid: GridVersion; readonly runId?: string }

export function defaultGrid1(ids: readonly SlideId[]): GridLayout {
  const columns = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(ids.length * 1.5))))
  return { starts: ids.filter((_, index) => index % columns === 0) }
}

export function defaultGrid2(
  ids: readonly SlideId[],
  file: readonly SlideId[],
  effects: readonly LegacySlideCommand[],
  starts: readonly SlideId[],
): GridLayout {
  if (starts.length === 0) return defaultGrid1(ids)
  const runs = partition(file, new Set(starts))
  const sections = sectionRuns(file, effects, ids, runs).filter((slides) => slides.length > 0)
  const base = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(ids.length * 1.5))))
  let heads = packSections(sections, base)
  if (sections.some((slides) => slides.length > base)) {
    for (let columns = base + 1; columns <= 10; columns++) {
      const candidate = packSections(sections, columns)
      if (candidate.length < heads.length) heads = candidate
    }
  }
  return { starts: heads }
}

function packSections(sections: readonly (readonly SlideId[])[], columns: number): readonly SlideId[] {
  const starts: SlideId[] = []
  let available = 0
  for (const slides of sections) {
    if (slides.length <= available) {
      available -= slides.length
      continue
    }
    for (let i = 0; i < slides.length; i += columns) starts.push(slides[i]!)
    available = Math.max(0, columns - slides.length)
  }
  return starts
}

export function gridSectionStarts(state: Pick<SlideState, "index" | "sectionStarts">): readonly SlideId[] | undefined {
  return indexedSectionStarts(state.index) ?? state.sectionStarts
}

export function orderedSpots(spots: readonly FoldedSlide[]): readonly FoldedSlide[] {
  return spots
    .filter((spot) => spot.present)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function foldGrid(
  state: SlideState,
  opening?: GridVersion,
): {
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
  let switched = false
  const effects: LegacySlideCommand[] = []
  const present = () => orderedSpots([...spots.values()])
  const sections = gridSectionStarts(state)
  const openingGrid = (ids: readonly SlideId[], version: GridVersion | undefined) =>
    version === 1 || sections === undefined ? defaultGrid1(ids) : defaultGrid2(ids, state.file, effects, sections)
  const tagging = opening === 3 || state.order.some((command) => command.grid === 3)
  let tags: Map<SlideId, HeadTag> | null = null
  const memory = new Map<SlideId, HeadTag>()
  const slideGroupsOf = (ids: readonly SlideId[]) =>
    mappedSlideGroups(ids, tags, sectionsOf(state.file, effects, ids, sections))
  for (const [position, command] of state.order.entries()) {
    if (elementCommand(command) || groupCommand(command)) {
      effects.push(command)
      continue
    }
    const before = present()
    const ids = before.map((spot) => spot.id)
    if (command.grid === 3 && !switched) {
      const opened = slideGroupsOf(ids)
      heads = new Set(opened.starts)
      tags = new Map(opened.starts.map((id, number) => [id, { key: opened.keys[number] ?? null, made: false }]))
      initialized = switched = true
      for (const [id, tag] of memory) if (tag.key === null) memory.delete(id)
    }
    if (!initialized && command.grid !== undefined) {
      if (command.grid === 2 && sections === undefined) throw new Error("missing section starts")
      heads = new Set(openingGrid(ids, command.grid).starts)
      if (tagging)
        tags = openingTags([...heads], sectionsOf(state.file, effects, ids, sections), ids, command.grid === 2)
      initialized = true
    }
    const groupsBefore = partition(ids, heads)
    if (command.slide === "move-many") {
      const moved = moveGroup(before, groupsBefore, command)
      for (const spot of moved.spots) spots.set(spot.id, spot)
      heads = moved.heads
      effects.push(...moved.effects)
    } else if (command.slide === "remove-many" || command.slide === "clone-many") {
      const changed = changeSet(before, groupsBefore, command)
      for (const spot of changed.spots) spots.set(spot.id, spot)
      heads = changed.heads
      effects.push(...changed.effects)
    } else if (command.slide === "grid-turn") {
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
      const sourceGroups = groupsBefore
      if (initialized && (command.slide === "remove" || command.slide === "move")) {
        const group = sourceGroups.find((group) => group.includes(command.id))
        if (group?.[0] === command.id) {
          heads.delete(command.id)
          if (group[1] !== undefined) heads.add(group[1])
        }
      }
      const remaining = before.filter((spot) => command.slide !== "move" || spot.id !== command.id)
      const anchor =
        command.slide === "add"
          ? command.grid !== undefined && command.row === "new"
            ? sourceGroups.find((group) => group.includes(command.after))?.at(-1)
            : command.after
          : command.slide === "clone"
            ? command.source
            : command.slide === "move" && command.grid !== undefined
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
        if (command.slide === "add" && command.grid !== undefined && command.row === "new") heads.add(command.id)
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
      const after = present()
      const kept = new Set(after.map((spot) => spot.id))
      heads = new Set([...heads].filter((id) => kept.has(id)))
      const first = after[0]
      if (first !== undefined) heads.add(first.id)
      if (tags !== null && (opening === 3 || !switched)) {
        const was = new Map(before.map((spot) => [spot.id, spot.key]))
        const now = new Map(after.map((spot) => [spot.id, spot.key]))
        const named = new Set(
          command.slide === "move-many"
            ? command.ids
            : command.slide === "move"
              ? [command.id]
              : command.slide === "grid-turn"
                ? command.turn.spots.flatMap((step) =>
                    step.before.present === step.after.present && step.before.key === step.after.key ? [] : [step.id],
                  )
                : [],
        )
        tags = retag(groupsBefore, tags, {
          ids: after.map((spot) => spot.id),
          heads,
          staying: (id) => !named.has(id) && was.has(id) && was.get(id) === now.get(id),
          memory,
          fresh: `n${String(position)}`,
          kept: command.slide === "move-many" && command.row === "keep" ? command.ids[0] : null,
          turn: command.slide === "grid-turn",
        })
      }
    }
  }
  const ids = present().map((spot) => spot.id)
  const keyed = switched && opening === 3 ? tags : null
  if (keyed !== null) {
    const starts = ids.filter((id) => heads.has(id))
    const keys = starts.map((id) => keyed.get(id)?.key ?? null)
    if (keys.includes(null)) throw new Error("slide group key")
    return { spots: [...spots.values()], grid: { starts, keys: keys.flatMap((key) => key ?? []) }, effects }
  }
  return {
    spots: [...spots.values()],
    grid:
      opening === 3 && !switched
        ? slideGroupsOf(ids)
        : initialized
          ? { starts: ids.filter((id) => heads.has(id)) }
          : openingGrid(ids, opening),
    effects,
  }
}
