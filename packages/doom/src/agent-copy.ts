import type { AgentChange } from "./agent-change.js"
import { type Draft, living, put, stop } from "./agent-draft.js"
import { duplicateWrites, pasteWrites } from "./copy-writes.js"
import { childrenOf, deckOf, propOf } from "./doom-walk.js"
import { type Grown, doomFromTree } from "./doom-tree.js"
import type { Write } from "./doom.js"
import { defaultTheme, themeLibrary } from "./theme.js"

export function compileDuplicate(draft: Draft, change: Extract<AgentChange, { op: "duplicate" }>): void {
  for (const id of change.nodes) {
    const node = living(draft, id, "nodes")
    if (node.type !== "slide" && node.type !== "frame" && node.type !== "shape")
      stop("shape", id, "nodes", "form", "A slide, a frame or a shape.")
  }
  draft.writes.push(...duplicateWrites(draft.doom, change.nodes, draft.mint).writes)
}

function grownPiece(change: Extract<AgentChange, { op: "paste" }>): Grown {
  try {
    return doomFromTree({ theme: defaultTheme, slides: [{ children: [change.piece] }] })
  } catch {
    return stop("shape", undefined, "piece", "form", "A piece whose layers each hold valid fields.")
  }
}

export function compilePaste(draft: Draft, change: Extract<AgentChange, { op: "paste" }>): void {
  const into = living(draft, change.into, "into")
  if (into.type !== "slide" && into.type !== "frame") stop("shape", into.id, "into", "form", "A slide or a frame.")
  const grown = grownPiece(change)
  const root = childrenOf(grown.doom, grown.slides[0]!)[0]!
  const copies = pasteWrites({ view: grown.doom, roots: [root.id] }, draft.doom, into.id, draft.mint)
  const copy = copies.made.get(root.id)
  const held = propOf(root, "box")
  const placed = (write: Write): Write =>
    write.node === copy && write.prop === "box" && held !== undefined && change.box !== undefined
      ? { ...write, value: { ...held, ...change.box } }
      : write
  draft.writes.push(...copies.writes.map(placed))
}

export function compileDeck(draft: Draft, change: Extract<AgentChange, { op: "deck" }>): void {
  const deck = deckOf(draft.doom) ?? stop("missing")
  const { name, nameFollows, language, theme: themeId, colors, fonts } = change
  if (
    name === undefined &&
    nameFollows === undefined &&
    language === undefined &&
    themeId === undefined &&
    colors === undefined &&
    fonts === undefined
  )
    stop("shape", deck.id, "deck", "missing", "A name, nameFollows, language, theme, colors or fonts.")
  const theme =
    themeId === undefined
      ? (propOf(deck, "theme") ?? stop("missing", deck.id, "theme"))
      : ((Object.hasOwn(themeLibrary, themeId) ? themeLibrary[themeId]?.theme : undefined) ??
        stop("shape", deck.id, "theme", "form", `One of ${Object.keys(themeLibrary).join(", ")}.`))
  put(draft, deck.id, {
    ...(name === undefined ? {} : { name }),
    ...(language === undefined ? {} : { language }),
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
