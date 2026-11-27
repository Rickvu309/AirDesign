import type { Intent } from "../intent-read.js"
import { compileIntent } from "../intent-compile.js"
import type { Reading } from "../intent-draft.js"
import { type NodeId, type Doom, type Write, applyEdit, isRefusal, nodeId, rev } from "../index.js"
import { agent, once, sampleDeck } from "../sample-deck.js"
import { childrenOf, slidesOf } from "../doom-walk.js"
import { doomFromTree } from "../doom-tree.js"
import { titleOnlyWrites } from "../slide-placeholders.js"
import { placement } from "./placement-rules.js"
import { starts } from "./start-rules.js"
import { testTheme } from "./theme.js"

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
  const result = applyEdit(doom, {
    once: once(),
    author: agent(run),
    writes,
    rev: rev(doom.rev + 1),
  })
  if (isRefusal(result)) throw new Error(`refused ${JSON.stringify(result)}`)
  return result
}

export function compiled(doom: Doom, intent: Intent, mint = minter(), reading: Reading = {}): readonly Write[] {
  const writes = compileIntent(doom, intent, mint, placement, starts, reading)
  if ("refused" in writes) throw new Error(`refused ${JSON.stringify(writes)}`)
  return writes
}

export const build = (doom: Doom, intent: Intent, mint = minter()): Doom => apply(doom, compiled(doom, intent, mint))

export const agentDeck = (): Doom => started(sampleDeck())

export const firstSlide = (doom: Doom): NodeId => slidesOf(doom)[0]!.id

export const lastChild = (doom: Doom, parent: NodeId) => childrenOf(doom, parent).at(-1)!

export function titledSlide(size: { readonly w: number; readonly h: number } = { w: 1920, h: 1080 }) {
  const grown = doomFromTree({ theme: testTheme, size, slides: [{ children: [] }] })
  const on = grown.slides[0]!
  const next = applyEdit(grown.doom, {
    once: "title",
    author: { kind: "person", id: "test" },
    writes: titleOnlyWrites(on, minter("t"), size, starts),
    rev: rev(grown.doom.rev + 1),
  })
  if (isRefusal(next)) throw new Error(JSON.stringify(next))
  return { doom: started(next), on }
}
