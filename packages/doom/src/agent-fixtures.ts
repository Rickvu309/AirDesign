import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import type { Reading } from "./agent-draft.js"
import { type NodeId, type Doom, type Write, applyEdit, isRefusal, nodeId, rev } from "./index.js"
import { agent, once, sampleDeck } from "./sample-deck.js"
import { childrenOf, slidesOf } from "./doom-walk.js"
import { defaultTheme } from "./default-theme-art.js"
import { doomFromTree } from "./doom-tree.js"
import { titleOnlyWrites } from "./slide-placeholders.js"

export const runName = "run-1"

export function minter(client = "a"): () => NodeId {
  let counter = 0
  return () => nodeId(`${client}:${(counter += 1)}`)
}

export function started(doom: Doom, run = runName): Doom {
  const result = applyEdit(doom, {
    once: once(),
    author: agent(run),
    writes: [],
    phase: "start",
    rev: rev(doom.rev + 1),
  })
  if (isRefusal(result)) throw new Error(`refused ${JSON.stringify(result)}`)
  return result
}

export function apply(doom: Doom, writes: readonly Write[], run = runName): Doom {
  const result = applyEdit(doom, { once: once(), author: agent(run), writes, rev: rev(doom.rev + 1) })
  if (isRefusal(result)) throw new Error(`refused ${JSON.stringify(result)}`)
  return result
}

export function compiled(doom: Doom, change: AgentChange, mint = minter(), reading: Reading = {}): readonly Write[] {
  const writes = compileAgentChange(doom, change, mint, reading)
  if ("refused" in writes) throw new Error(`refused ${JSON.stringify(writes)}`)
  return writes
}

export const build = (doom: Doom, change: AgentChange, mint = minter()): Doom =>
  apply(doom, compiled(doom, change, mint))

export const agentDeck = (): Doom => started(sampleDeck())

export const firstSlide = (doom: Doom): NodeId => slidesOf(doom)[0]!.id

export const lastChild = (doom: Doom, parent: NodeId) => childrenOf(doom, parent).at(-1)!

export function titledSlide(size: { readonly w: number; readonly h: number } = { w: 1920, h: 1080 }) {
  const grown = doomFromTree({ theme: defaultTheme, size, slides: [{ children: [] }] })
  const on = grown.slides[0]!
  const next = applyEdit(grown.doom, {
    once: "title",
    author: { kind: "person", id: "test" },
    writes: titleOnlyWrites(on, minter("t"), size),
    rev: rev(grown.doom.rev + 1),
  })
  if (isRefusal(next)) throw new Error(JSON.stringify(next))
  return { doom: started(next), on }
}
