import { describe, expect, it } from "vitest"
import { deckOf } from "./deck-of.js"
import { nameFromTitleWrites } from "./deck-name-from-title.js"
import { childrenOf, propOf } from "./doom-walk.js"
import { doomFromTree } from "./doom-tree.js"
import { applyEdit, emptyDoom, isRefusal, rev, type Doom, type NodeId } from "./index.js"
import { slideStartWrites } from "./slide-starts.js"
import type { StartRules } from "./start-rules.js"
import { minter } from "./testing/agent-fixtures.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"
import { testTheme as theme } from "./testing/theme.js"

const person = { kind: "person", id: "test" } as const

const french: StartRules = {
  ...starts,
  deckName: "Présentation vide",
  title: { name: "Titre", chars: "Sans titre" },
  subtitle: { name: "Sous-titre", chars: "Sous-titre" },
  marginShare: 1 / 10,
  content: {
    text: [{ op: "add", kind: "text", textStyle: "body", text: "- Premier point" }],
    grid: [
      {
        op: "add",
        kind: "frame",
        rows: [
          ["", "Colonne"],
          ["Ligne", "Texte"],
        ],
      },
    ],
  },
}

function started(rules: StartRules, start: "title" | "text" | "grid"): { doom: Doom; slide: NodeId } {
  const grown = doomFromTree({ theme, slides: [{ children: [] }] })
  const slide = grown.slides[0]!
  const writes = slideStartWrites(grown.doom, slide, minter("s"), start, placement, rules)
  const next = applyEdit(grown.doom, { once: "start", author: person, writes, rev: rev(grown.doom.rev + 1) })
  if (isRefusal(next)) throw new Error(JSON.stringify(next))
  return { doom: next, slide }
}

const wordsOn = (doom: Doom, slide: NodeId): readonly string[] =>
  childrenOf(doom, slide).flatMap((node) => [
    propOf(node, "name") ?? "",
    propOf(node, "text")?.chars ?? "",
    ...childrenOf(doom, node.id).map((cell) => propOf(cell, "text")?.chars ?? ""),
  ])

describe("a new slide follows the start rules it is given", () => {
  it("names and words its title slide placeholders from the rules", () => {
    const { doom, slide } = started(french, "title")
    expect(wordsOn(doom, slide)).toEqual(["Titre", "Sans titre", "Sous-titre", "Sous-titre"])
    expect(propOf(childrenOf(doom, slide)[0]!, "box")?.x).toBe(192)
  })

  it("fills a start's content from the rules", () => {
    const text = started(french, "text")
    expect(wordsOn(text.doom, text.slide)).toContain("Premier point")
    const grid = started(french, "grid")
    expect(wordsOn(grid.doom, grid.slide)).toEqual(expect.arrayContaining(["Colonne", "Ligne", "Texte"]))
  })

  it("names a deck from its rules' blank name when the title is cleared", () => {
    const { doom, slide } = started(french, "title")
    const title = childrenOf(doom, slide)[0]!
    const deck = [...doom.nodes.values()].find((node) => node.type === "deck")!
    const following = applyEdit(doom, {
      once: "follow",
      author: person,
      writes: [{ node: deck.id, prop: "nameFollows", value: true }],
      rev: rev(doom.rev + 1),
    })
    if (isRefusal(following)) throw new Error(JSON.stringify(following))
    const cleared = { ...propOf(title, "text")!, chars: "" }
    const writes = nameFromTitleWrites(following, [{ node: title.id, prop: "text", value: cleared }], french)
    expect(writes).toContainEqual(expect.objectContaining({ prop: "name", value: "Présentation vide" }))
  })
})

describe("a deck's look", () => {
  it("is read from the deck, with no look of Doom's own", () => {
    expect(deckOf(doomFromTree({ theme, slides: [] }).doom)).toEqual({ theme, size: { w: 1920, h: 1080 } })
    expect(() => deckOf(emptyDoom)).toThrow()
  })
})
