import { compileAdd } from "./agent-add.js"
import { compileDelete, compileMove, compileUnwrap, compileWrap } from "./agent-arrange.js"
import { compileSet } from "./agent-set.js"
import { compileSlide } from "./agent-slide.js"
import { compileDeck, compileDuplicate, compilePaste } from "./agent-copy.js"
import type { AgentChange, AgentRefusal } from "./agent-change.js"
import { type Reading, Stop, draftOf } from "./agent-draft.js"
import type { NodeId } from "./ids.js"
import type { Write } from "./doom.js"
import type { Doom } from "./doom.js"
import { freeLineEnds } from "./freed-line-ends.js"
import { measureWith } from "./measure.js"
import type { PlacementRules } from "./placement-rules.js"

const estimate = measureWith({})

export function nameOf(change: AgentChange): string {
  switch (change.op) {
    case "add":
      return `add ${change.kind}`
    case "set":
      return `${change.op} ${change.target}`
    case "move": {
      const ids = change.nodes ?? (change.node === undefined ? [] : [change.node])
      return `move ${ids[0] ?? ""}${ids.length > 1 ? `+${ids.length - 1}` : ""}`
    }
    case "unwrap":
      return `${change.op} ${change.node}`
    case "wrap":
    case "delete":
    case "duplicate":
      return `${change.op} ${change.nodes[0] ?? ""}${change.nodes.length > 1 ? `+${change.nodes.length - 1}` : ""}`
    case "slide":
      return `slide ${change.add !== undefined ? "add" : change.move !== undefined ? "move" : change.delete !== undefined ? "delete" : ""}`.trim()
    case "paste":
      return `paste ${change.piece.name ?? change.piece.type}`
    case "deck":
      return "deck"
  }
}

export function compileAgentChange(
  doom: Doom,
  change: AgentChange,
  mint: () => NodeId,
  placement: PlacementRules,
  reading: Reading = {},
): readonly Write[] | AgentRefusal {
  const draft = draftOf(doom, mint, placement, reading)
  try {
    if (change.op === "add") compileAdd(draft, change)
    if (change.op === "set") compileSet(draft, change)
    if (change.op === "move") compileMove(draft, change)
    if (change.op === "wrap") compileWrap(draft, change)
    if (change.op === "unwrap") compileUnwrap(draft, change)
    if (change.op === "duplicate") compileDuplicate(draft, change)
    if (change.op === "paste") compilePaste(draft, change)
    if (change.op === "deck") compileDeck(draft, change)
    if (change.op === "delete") compileDelete(draft, change)
    if (change.op === "slide") compileSlide(draft, change)
    return freeLineEnds(doom, draft.writes, reading.measure ?? estimate)
  } catch (thrown) {
    if (thrown instanceof Stop) return { ...thrown.refusal, change: nameOf(change) }
    throw thrown
  }
}
