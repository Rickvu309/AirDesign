import { describe, expect, it } from "vitest"
import { applyEdit } from "./apply-edit.js"
import { deckName } from "./deck-of.js"
import { defaultTheme } from "./theme.js"
import { doomFromTree } from "./doom-tree.js"
import { emptyDoom } from "./doom.js"
import { rev } from "./ids.js"

describe("a deck grown from a tree", () => {
  it("takes the tree's name, or a plain one when the tree has none", () => {
    expect(deckName(doomFromTree({ theme: defaultTheme, name: "Q3 update", slides: [] }).doom)).toBe("Q3 update")
    expect(deckName(doomFromTree({ theme: defaultTheme, slides: [] }).doom)).toBe("deck")
  })

  it("hands back the one edit that grows it, so a server can start from the same deck", () => {
    const grown = doomFromTree({ theme: defaultTheme, slides: [{ children: [{ type: "shape", name: "dot" }] }] })
    expect(applyEdit(emptyDoom, { ...grown.edit, rev: rev(1) })).toEqual(grown.doom)
  })
})
