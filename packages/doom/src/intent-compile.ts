import { compileAdd } from "./intent-add.js"
import { compileDelete, compileMove, compileUnwrap, compileWrap } from "./intent-arrange.js"
import { compileSet } from "./intent-set.js"
import { compileSlide } from "./intent-slide.js"
import { compileDeck, compileDuplicate, compilePaste } from "./intent-copy.js"
import type { Intent, IntentRefusal } from "./intent-read.js"
import { type Reading, Stop, draftOf } from "./intent-draft.js"
import type { NodeId } from "./ids.js"
import type { Write } from "./doom.js"
import type { Doom } from "./doom.js"
import { freeLineEnds } from "./freed-line-ends.js"
import { measureWith } from "./measure.js"
import type { PlacementRules } from "./placement-rules.js"
import type { StartRules } from "./start-rules.js"

const estimate = measureWith({})

export function nameOf(intent: Intent): string {
  switch (intent.op) {
    case "add":
      return `add ${intent.kind}`
    case "set":
      return `${intent.op} ${intent.target}`
    case "move": {
      const ids = intent.nodes ?? (intent.node === undefined ? [] : [intent.node])
      return `move ${ids[0] ?? ""}${ids.length > 1 ? `+${ids.length - 1}` : ""}`
    }
    case "unwrap":
      return `${intent.op} ${intent.node}`
    case "wrap":
    case "delete":
    case "duplicate":
      return `${intent.op} ${intent.nodes[0] ?? ""}${intent.nodes.length > 1 ? `+${intent.nodes.length - 1}` : ""}`
    case "slide":
      return `slide ${intent.add !== undefined ? "add" : intent.move !== undefined ? "move" : intent.delete !== undefined ? "delete" : ""}`.trim()
    case "paste":
      return `paste ${intent.piece.name ?? intent.piece.type}`
    case "deck":
      return "deck"
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
    if (intent.op === "add") compileAdd(draft, intent, starts)
    if (intent.op === "set") compileSet(draft, intent)
    if (intent.op === "move") compileMove(draft, intent)
    if (intent.op === "wrap") compileWrap(draft, intent)
    if (intent.op === "unwrap") compileUnwrap(draft, intent)
    if (intent.op === "duplicate") compileDuplicate(draft, intent)
    if (intent.op === "paste") compilePaste(draft, intent)
    if (intent.op === "deck") compileDeck(draft, intent)
    if (intent.op === "delete") compileDelete(draft, intent)
    if (intent.op === "slide") compileSlide(draft, intent)
    return freeLineEnds(doom, draft.writes, reading.measure ?? estimate)
  } catch (thrown) {
    if (thrown instanceof Stop) return { ...thrown.refusal, change: nameOf(intent) }
    throw thrown
  }
}
