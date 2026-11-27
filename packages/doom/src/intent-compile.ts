import { compileInsertLayer } from "./intent-add.js"
import { compileGroup, compileMove, compileRemove, compileUngroup } from "./intent-arrange.js"
import { compileSet } from "./intent-set.js"
import { compileInsertSlide } from "./intent-slide.js"
import { compileCopy, compilePaste, compileVariables } from "./intent-copy.js"
import { compileReorder } from "./intent-reorder.js"
import { compileReplace } from "./intent-replace.js"
import type { Intent, IntentRefusal } from "./intent-read.js"
import { type Draft, type Reading, Stop, draftOf } from "./intent-draft.js"
import type { NodeId } from "./ids.js"
import type { Write } from "./doom.js"
import type { Doom } from "./doom.js"
import { freeLineEnds } from "./freed-line-ends.js"
import { measureWith } from "./measure.js"
import type { PlacementRules } from "./placement-rules.js"
import type { StartRules } from "./start-rules.js"

const estimate = measureWith({})

const listed = (ids: readonly NodeId[]) => `${ids[0] ?? ""}${ids.length > 1 ? `+${ids.length - 1}` : ""}`

export function nameOf(intent: Intent): string {
  switch (intent.op) {
    case "insert":
      return `insert ${intent.kind}`
    case "update":
    case "replace":
    case "ungroup":
      return `${intent.op} ${intent.target}`
    case "copy":
    case "move":
    case "reorder":
    case "remove":
    case "group":
      return `${intent.op} ${listed(intent.targets)}`
    case "paste":
      return `paste ${intent.piece.name ?? intent.piece.type}`
    case "variables":
      return "variables"
  }
}

function compileOne(draft: Draft, intent: Intent, starts: StartRules): void {
  switch (intent.op) {
    case "insert":
      return intent.kind === "slide" ? compileInsertSlide(draft, intent) : compileInsertLayer(draft, intent, starts)
    case "update":
      return compileSet(draft, intent)
    case "replace":
      return compileReplace(draft, intent)
    case "copy":
      return compileCopy(draft, intent)
    case "paste":
      return compilePaste(draft, intent)
    case "move":
      return compileMove(draft, intent)
    case "reorder":
      return compileReorder(draft, intent)
    case "remove":
      return compileRemove(draft, intent)
    case "group":
      return compileGroup(draft, intent)
    case "ungroup":
      return compileUngroup(draft, intent)
    case "variables":
      return compileVariables(draft, intent)
  }
}

export function compileIntent(
  doom: Doom,
  intent: Intent,
  mint: () => NodeId,
  placement: PlacementRules,
  starts: StartRules,
  reading: Reading = {},
): readonly Write[] | IntentRefusal {
  const draft = draftOf(doom, mint, placement, reading)
  try {
    compileOne(draft, intent, starts)
    return freeLineEnds(doom, draft.writes, reading.measure ?? estimate)
  } catch (thrown) {
    if (thrown instanceof Stop) return { ...thrown.refusal, change: nameOf(intent) }
    throw thrown
  }
}
