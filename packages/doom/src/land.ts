import { applyEdit } from "./apply-edit.js"
import { changingWrites } from "./changing-writes.js"
import { nameFromTitleWrites } from "./deck-name-from-title.js"
import type { Author, Doom, Edit, Write } from "./doom.js"
import { freeLineEnds } from "./freed-line-ends.js"
import { type Rev, rev } from "./ids.js"
import type { Measure } from "./measure.js"
import { type Refusal, isRefusal } from "./refusal.js"
import type { StartRules } from "./start-rules.js"
import { onTop } from "./view-of.js"

export type LandBy = {
  readonly author: Author
  readonly once: string
  readonly measure: Measure
  readonly starts: StartRules
  readonly readBase?: Rev
  readonly phase?: "start" | "stop"
  readonly seen?: Doom
}

export type Landing = { readonly after: Doom; readonly edit: Edit; readonly named: readonly Write[] }

function landOn(fold: Doom, edit: Edit): Doom | Refusal {
  const made = onTop(fold, edit).writes
  const writes = edit.writes.map((write, at) => (write.base === undefined ? made[at]! : write))
  return applyEdit(fold, { ...edit, writes, rev: rev(fold.rev + 1) })
}

export function land(fold: Doom, asked: readonly Write[], by: LandBy): Landing | Refusal {
  const edit = (writes: readonly Write[]): Edit => ({
    once: by.once,
    author: by.author,
    writes,
    ...(by.readBase === undefined ? {} : { readBase: by.readBase }),
    ...(by.phase === undefined ? {} : { phase: by.phase }),
  })
  const given = changingWrites(fold, asked)
  const own = given.length === 0 ? given : freeLineEnds(fold, given, by.measure, by.seen)
  const first = own.length === 0 && by.phase === undefined ? fold : landOn(fold, edit(own))
  if (isRefusal(first)) return first
  const named = nameFromTitleWrites(fold, asked, by.starts, first)
  if (named.length === 0) return { after: first, edit: edit(own), named }
  const writes = freeLineEnds(fold, [...given, ...named], by.measure, by.seen)
  const after = landOn(fold, edit(writes))
  return isRefusal(after) ? after : { after, edit: edit(writes), named }
}
