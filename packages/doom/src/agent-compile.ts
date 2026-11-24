import { compileAdd } from "./agent-add.js"
import { compileDelete, compileMove, compileUnwrap, compileWrap } from "./agent-arrange.js"
import { compileSet } from "./agent-set.js"
import { compileSlide } from "./agent-slide.js"
import { compileDeck, compileDuplicate } from "./agent-copy.js"
import type { AgentChange, AgentRefusal } from "./agent-change.js"
import { type Reading, Stop, draftOf } from "./agent-draft.js"
import type { NodeId } from "./ids.js"
import type { Write } from "./doom.js"
import type { Doom } from "./doom.js"
import { freeLineEnds } from "./freed-line-ends.js"
import { measureWith } from "./measure.js"

export function nameOf(change: AgentChange): string {
  switch (change.op) {
    case "add":
      return `add ${change.kind}`
    case "set":
      return `set ${change.target}`
    case "move":
    case "unwrap":
      return `${change.op} ${change.node}`
    case "wrap":
    case "delete":
    case "duplicate":
      return `${change.op} ${change.nodes[0] ?? ""}${change.nodes.length > 1 ? `+${change.nodes.length - 1}` : ""}`
    case "slide":
      return `slide ${change.add !== undefined ? "add" : change.move !== undefined ? "move" : change.delete !== undefined ? "delete" : ""}`.trim()
    case "deck":
      return "deck"
  }
}

export function compileAgentChange(
  doom: Doom,
  change: AgentChange,
  mint: () => NodeId,
  reading: Reading = {},
): readonly Write[] | AgentRefusal {
  const draft = draftOf(doom, mint, reading)
  try {
    if (change.op === "add") compileAdd(draft, change)
    if (change.op === "set") compileSet(draft, change)
    if (change.op === "move") compileMove(draft, change)
    if (change.op === "wrap") compileWrap(draft, change)
    if (change.op === "unwrap") compileUnwrap(draft, change)
    if (change.op === "duplicate") compileDuplicate(draft, change)
    if (change.op === "deck") compileDeck(draft, change)
    if (change.op === "delete") compileDelete(draft, change)
    if (change.op === "slide") compileSlide(draft, change)
    return freeLineEnds(doom, draft.writes, reading.measure ?? measureWith({}))
  } catch (thrown) {
    if (thrown instanceof Stop) return { ...thrown.refusal, change: nameOf(change) }
    throw thrown
  }
}
