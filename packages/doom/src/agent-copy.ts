import type { AgentChange } from "./agent-change.js"
import { type Draft, living, put, stop } from "./agent-draft.js"
import { duplicateWrites } from "./copy-writes.js"
import { deckOf, propOf } from "./doom-walk.js"

export function compileDuplicate(draft: Draft, change: Extract<AgentChange, { op: "duplicate" }>): void {
  for (const id of change.nodes) {
    const node = living(draft, id, "nodes")
    if (node.type !== "slide" && node.type !== "frame" && node.type !== "shape") stop("shape", id, "nodes")
  }
  draft.writes.push(...duplicateWrites(draft.doom, change.nodes, draft.mint).writes)
}

export function compileDeck(draft: Draft, change: Extract<AgentChange, { op: "deck" }>): void {
  const deck = deckOf(draft.doom) ?? stop("missing")
  const { name, nameFollows, colors, fonts } = change
  if (name === undefined && nameFollows === undefined && colors === undefined && fonts === undefined)
    stop("shape", deck.id, "deck")
  const theme = propOf(deck, "theme") ?? stop("missing", deck.id, "theme")
  put(draft, deck.id, {
    ...(name === undefined ? {} : { name }),
    ...(nameFollows === undefined ? {} : { nameFollows }),
    ...(colors === undefined && fonts === undefined
      ? {}
      : {
          theme: {
            ...theme,
            colors: { ...theme.colors, ...colors },
            fonts: { ...theme.fonts, ...fonts },
          },
        }),
  })
}
