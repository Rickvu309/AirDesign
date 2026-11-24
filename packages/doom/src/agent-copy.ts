import type { AgentChange } from "./agent-change.js"
import { type Draft, living, put, stop } from "./agent-draft.js"
import { duplicateWrites } from "./copy-writes.js"
import { deckOf, propOf } from "./doom-walk.js"
import { themeLibrary } from "./theme.js"

export function compileDuplicate(draft: Draft, change: Extract<AgentChange, { op: "duplicate" }>): void {
  for (const id of change.nodes) {
    const node = living(draft, id, "nodes")
    if (node.type !== "slide" && node.type !== "frame" && node.type !== "shape")
      stop("shape", id, "nodes", "form", "A slide, a frame or a shape.")
  }
  draft.writes.push(...duplicateWrites(draft.doom, change.nodes, draft.mint).writes)
}

export function compileDeck(draft: Draft, change: Extract<AgentChange, { op: "deck" }>): void {
  const deck = deckOf(draft.doom) ?? stop("missing")
  const { name, nameFollows, theme: themeId, colors, fonts } = change
  if (
    name === undefined &&
    nameFollows === undefined &&
    themeId === undefined &&
    colors === undefined &&
    fonts === undefined
  )
    stop("shape", deck.id, "deck", "missing", "A name, nameFollows, theme, colors or fonts.")
  const theme =
    themeId === undefined
      ? (propOf(deck, "theme") ?? stop("missing", deck.id, "theme"))
      : ((Object.hasOwn(themeLibrary, themeId) ? themeLibrary[themeId]?.theme : undefined) ??
        stop("shape", deck.id, "theme", "form", `One of ${Object.keys(themeLibrary).join(", ")}.`))
  put(draft, deck.id, {
    ...(name === undefined ? {} : { name }),
    ...(nameFollows === undefined ? {} : { nameFollows }),
    ...(themeId === undefined && colors === undefined && fonts === undefined
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
