import type { Intent } from "./intent-read.js"
import { type Draft, living, put, stop } from "./intent-draft.js"
import { duplicateWrites, pasteWrites } from "./copy-writes.js"
import { childrenOf, deckOf, propOf } from "./doom-walk.js"
import { type Grown, doomFromTree } from "./doom-tree.js"
import type { Write } from "./doom.js"
import { deckOf as deckLookOf } from "./deck-of.js"

export function compileCopy(draft: Draft, intent: Extract<Intent, { op: "copy" }>): void {
  for (const id of intent.targets) {
    const node = living(draft, id, "targets")
    if (node.type !== "slide" && node.type !== "frame" && node.type !== "shape")
      stop("shape", id, "targets", "form", { code: "copyable-node" })
  }
  draft.writes.push(...duplicateWrites(draft.doom, intent.targets, draft.mint).writes)
}

function grownPiece(draft: Draft, intent: Extract<Intent, { op: "paste" }>): Grown {
  try {
    return doomFromTree({ theme: deckLookOf(draft.doom).theme, slides: [{ children: [intent.piece] }] })
  } catch {
    return stop("shape", undefined, "piece", "form", { code: "valid-piece" })
  }
}

export function compilePaste(draft: Draft, intent: Extract<Intent, { op: "paste" }>): void {
  const into = living(draft, intent.parent, "parent")
  if (into.type !== "slide" && into.type !== "frame")
    stop("shape", into.id, "parent", "form", { code: "slide-or-frame" })
  const grown = grownPiece(draft, intent)
  const root = childrenOf(grown.doom, grown.slides[0]!)[0]!
  const copies = pasteWrites({ view: grown.doom, roots: [root.id] }, draft.doom, into.id, draft.mint)
  const copy = copies.made.get(root.id)
  const held = propOf(root, "box")
  const placed = (write: Write): Write =>
    write.node === copy && write.prop === "box" && held !== undefined && intent.box !== undefined
      ? { ...write, value: { ...held, ...intent.box } }
      : write
  draft.writes.push(...copies.writes.map(placed))
}

export function compileVariables(draft: Draft, intent: Extract<Intent, { op: "variables" }>): void {
  const deck = deckOf(draft.doom) ?? stop("missing")
  const { name, nameFollows, language, theme: newTheme, colors, fonts } = intent
  if (
    name === undefined &&
    nameFollows === undefined &&
    language === undefined &&
    newTheme === undefined &&
    colors === undefined &&
    fonts === undefined
  )
    stop("shape", deck.id, "deck", "missing", { code: "deck-look" })
  const theme = newTheme ?? deckLookOf(draft.doom).theme
  put(draft, deck.id, {
    ...(name === undefined ? {} : { name }),
    ...(language === undefined ? {} : { language }),
    ...(nameFollows === undefined ? {} : { nameFollows }),
    ...(newTheme === undefined && colors === undefined && fonts === undefined
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
