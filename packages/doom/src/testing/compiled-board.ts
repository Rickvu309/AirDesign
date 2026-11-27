import { type AgentChange, type Doom, type NodeId, applyEdit, isRefusal, rev } from "../index.js"
import { compileAgentEdit } from "../agent-edit.js"
import { agent, ids } from "../sample-deck.js"
import { agentDeck, minter, runName } from "./agent-fixtures.js"
import { boardDeckChanges } from "./board-deck.js"
import { placement } from "./placement-rules.js"
import { starts } from "./start-rules.js"

export function board(mode: "together" | "per-slide"): {
  readonly doom: Doom
  readonly batches: readonly (readonly AgentChange[])[]
  readonly slides: readonly NodeId[]
} {
  const mint = minter("b")
  let doom = agentDeck()
  const batches: (readonly AgentChange[])[] = []
  const send = (changes: readonly AgentChange[]): readonly NodeId[] => {
    batches.push(changes)
    const result = compileAgentEdit(doom, changes, {
      placement,
      starts,
      author: agent(runName),
      once: `board-${batches.length}`,
      mint,
    })
    if ("refused" in result) throw new Error(`batch ${batches.length}: ${JSON.stringify(result)}`)
    const landed = applyEdit(doom, { ...result.edit, rev: rev(doom.rev + 1) })
    if (isRefusal(landed)) throw new Error(JSON.stringify(landed))
    doom = landed
    return result.added.map((each) => each.id)
  }
  const added = send(Array.from({ length: 4 }, () => ({ op: "slide", add: {} })))
  const slides = [ids.slide, ...added]
  const parts = boardDeckChanges(slides)
  if (mode === "together") send(parts.flat())
  else for (const part of parts) send(part)
  return { doom, batches, slides }
}
