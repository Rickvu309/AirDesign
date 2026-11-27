import type { Author, Doom, Edit, Landed, RunUndo, Write } from "./doom.js"
import { propOf } from "./doom-walk.js"
import { freeLineEnds } from "./freed-line-ends.js"
import type { NodeId, Rev } from "./ids.js"
import { invert } from "./invert.js"
import { type RunEdit, type Undone, invertRun } from "./invert-run.js"
import { landOn } from "./land.js"
import { lineEndsBack } from "./line-ends-back.js"
import type { Measure } from "./measure.js"
import { type Refusal, isRefusal } from "./refusal.js"
import { type LayerPositions, onStandingLayers } from "./standing-layers.js"

export type Pressed = {
  readonly writes: readonly Write[]
  readonly since: Rev
  readonly measuredIn: ReadonlyMap<NodeId, NodeId | null>
  readonly lines: ReadonlyMap<NodeId, unknown>
}

export type Undoable =
  | { readonly step: Landed; readonly before: Doom }
  | { readonly run: readonly RunEdit[]; readonly started?: LayerPositions | Doom | undefined }
  | { readonly pressed: Pressed }

export type UndoBy = {
  readonly author: Author
  readonly once: string
  readonly measure: Measure
  readonly owned: ReadonlySet<Rev>
  readonly readBase?: Rev
  readonly runUndo?: RunUndo
}

export type Undoing = { readonly after: Doom; readonly edit: Edit } & Omit<Undone, "writes">

const nothingStays = { kept: [], left: [], waiting: [] } as const

function endsOnly(fold: Doom, write: Write, pressed: Pressed, at: Rev): Write | undefined {
  if (write.prop !== "geometry") return undefined
  const ends = lineEndsBack(write.value, propOf(fold.nodes.get(write.node), "geometry"), pressed.lines.get(write.node))
  return ends === undefined ? undefined : { ...write, value: ends, base: at }
}

function onStandingOnly(fold: Doom, pressed: Pressed, owned: ReadonlySet<Rev>): readonly Write[] {
  const kept = pressed.writes.flatMap((write) => {
    const at = fold.revs.get(write.node)?.get(write.prop)
    const theirs = at !== undefined && at > pressed.since && !owned.has(at) && (write.base ?? 0) < at
    if (!theirs) return [write]
    const ends = endsOnly(fold, write, pressed, at)
    return ends === undefined ? [] : [ends]
  })
  return onStandingLayers(fold, kept, pressed.since, pressed.since, pressed.measuredIn)
}

function inverse(fold: Doom, undoable: Undoable, owned: ReadonlySet<Rev>): Undone & { readonly last: Doom } {
  if ("step" in undoable)
    return { writes: invert(undoable.before, fold, undoable.step, owned), ...nothingStays, last: undoable.before }
  if ("run" in undoable) return { ...invertRun(fold, undoable.run, owned, undoable.started), last: fold }
  return { writes: onStandingOnly(fold, undoable.pressed, owned), ...nothingStays, last: fold }
}

export function undo(fold: Doom, undoable: Undoable, by: UndoBy): Undoing | Refusal {
  const { writes: inverted, last, ...stays } = inverse(fold, undoable, by.owned)
  const edit: Edit = {
    once: by.once,
    author: by.author,
    writes: freeLineEnds(fold, inverted, by.measure, fold, last),
    ...(by.readBase === undefined ? {} : { readBase: by.readBase }),
    ...(by.runUndo === undefined ? {} : { runUndo: by.runUndo }),
  }
  if (edit.writes.length === 0) return { after: fold, edit, ...stays }
  const after = landOn(fold, edit)
  return isRefusal(after) ? after : { after, edit, ...stays }
}
