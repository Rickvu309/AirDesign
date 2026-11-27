import { describe, expect, it } from "vitest"
import type { Intent } from "./intent-read.js"
import { readIntent } from "./intent-read.js"
import { compileIntent } from "./intent-compile.js"
import { agentDeck, apply, build, lastChild, minter } from "./testing/agent-fixtures.js"
import { childrenOf, propOf, slidesOf } from "./doom-walk.js"
import type { Doom } from "./doom.js"
import { ids, theme } from "./sample-deck.js"
import { titleSlideWrites } from "./slide-placeholders.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"

const set = (target: string, look: Record<string, unknown>): Intent => ({ op: "set", target, ...look }) as Intent
const at = (doom: Doom, id: string) => doom.nodes.get(id as never)!

describe("rotation and flips land on the box the canvas's rotate and flip write", () => {
  it("turns and mirrors a layer and reads it back", () => {
    let doom = build(agentDeck(), set(ids.card, { rotation: 15, flip: "h" }))
    expect(propOf(at(doom, ids.card), "box")).toMatchObject({ x: 100, rotation: 15, flipH: true, flipV: false })
    doom = build(doom, set(ids.card, { flip: "none" }))
    expect(propOf(at(doom, ids.card), "box")).toMatchObject({ rotation: 15, flipH: false, flipV: false })
  })

  it("wraps a turn past a whole one onto the circle in tenths, as the canvas's rotate stores it", () => {
    const turned = (rotation: number) => {
      const read = readIntent(set(ids.card, { rotation }))
      if ("refused" in read) throw new Error(JSON.stringify(read))
      return propOf(at(build(agentDeck(), read), ids.card), "box")?.rotation
    }
    expect(turned(400)).toBe(40)
    expect(turned(-90)).toBe(270)
    expect(turned(12.34)).toBe(12.3)
    expect(turned(359.97)).toBe(0)
    expect(readIntent(set(ids.card, { rotation: "90" as never }))).toMatchObject({ refused: "shape" })
    expect(readIntent(set(ids.card, { rotation: Infinity }))).toMatchObject({ refused: "shape" })
  })

  it("turns and mirrors a layer in the add that makes it, as the set that follows would", () => {
    const kinds = [
      { kind: "shape", fill: "accent1" },
      { kind: "line" },
      { kind: "frame" },
      {
        kind: "frame",
        rows: [
          ["A", "B"],
          ["1", "2"],
        ],
      },
      { kind: "icon", icon: "star" },
      { kind: "text", text: "Note" },
      { kind: "picture", fill: { image: "https://x.test/a.png" } },
    ]
    for (const made of kinds) {
      const read = readIntent({ op: "add", slide: ids.slide, rotation: -90, flip: "v", ...made })
      if ("refused" in read) throw new Error(JSON.stringify(read))
      const doom = build(agentDeck(), read)
      expect(propOf(lastChild(doom, ids.slide), "box"), made.kind).toMatchObject({
        rotation: 270,
        flipH: false,
        flipV: true,
      })
    }
  })

  it("keeps rotation and flip when an add of text fills an empty title or subtitle placeholder", () => {
    const before = apply(agentDeck(), titleSlideWrites(ids.slide, minter("p"), { w: 1920, h: 1080 }, starts))
    const byRole = (doom: Doom, role: "title" | "subtitle") =>
      childrenOf(doom, ids.slide).find((node) => propOf(node, "role") === role)!
    const titleBefore = propOf(byRole(before, "title"), "box")!
    const subtitleBefore = propOf(byRole(before, "subtitle"), "box")!

    const titleRead = readIntent({
      op: "add",
      kind: "text",
      slide: ids.slide,
      text: "Q3 board update",
      textStyle: "title",
      rotation: -90,
      flip: "h",
    })
    if ("refused" in titleRead) throw new Error(JSON.stringify(titleRead))
    const titled = build(before, titleRead)
    expect(propOf(byRole(titled, "title"), "box")).toEqual({
      ...titleBefore,
      rotation: 270,
      flipH: true,
      flipV: false,
    })

    const subRead = readIntent({
      op: "add",
      kind: "text",
      slide: ids.slide,
      text: "Revenue grew",
      rotation: 400,
      flip: "hv",
    })
    if ("refused" in subRead) throw new Error(JSON.stringify(subRead))
    const both = build(titled, subRead)
    expect(propOf(byRole(both, "subtitle"), "box")).toEqual({
      ...subtitleBefore,
      rotation: 40,
      flipH: true,
      flipV: true,
    })
  })

  it("refuses a rotation on a slide", () => {
    expect(compileIntent(agentDeck(), set(ids.slide, { rotation: 10 }), minter(), placement, starts)).toMatchObject({
      refused: "shape",
    })
  })
})

describe("duplicate copies a layer or a slide the way the canvas's duplicate does", () => {
  it("puts a copy of a layer and its children right after it", () => {
    const doom = build(agentDeck(), { op: "duplicate", nodes: [ids.side] })
    const [, , copy] = childrenOf(doom, ids.slide)
    expect(childrenOf(doom, ids.slide).map((node) => node.id)).toEqual([ids.card, ids.side, copy!.id])
    expect(childrenOf(doom, copy!.id)).toHaveLength(1)
  })

  it("copies a whole slide after it, and refuses the deck", () => {
    const doom = build(agentDeck(), { op: "duplicate", nodes: [ids.slide] })
    expect(slidesOf(doom)).toHaveLength(2)
    expect(
      compileIntent(agentDeck(), { op: "duplicate", nodes: [ids.deck] }, minter(), placement, starts),
    ).toMatchObject({
      refused: "shape",
    })
  })
})

describe("presenter notes and the deck's name and theme", () => {
  it("writes a slide's notes as the notes bar holds them, plain words, and reads them back", () => {
    const doom = build(agentDeck(), set(ids.slide, { notes: "Open with the number.\nThen the why." }))
    expect(propOf(at(doom, ids.slide), "notes")).toMatchObject({ chars: "Open with the number.\nThen the why." })
    expect(compileIntent(agentDeck(), set(ids.card, { notes: "x" }), minter(), placement, starts)).toMatchObject({
      refused: "shape",
    })
  })

  it("renames the deck and changes the theme's colours and fonts, keeping the rest of the theme", () => {
    const blue = theme().colors.accent3
    const doom = build(agentDeck(), {
      op: "deck",
      name: "Board",
      colors: { accent1: blue },
      fonts: { heading: "Lora" },
    })
    expect(propOf(at(doom, ids.deck), "name")).toBe("Board")
    expect(propOf(at(doom, ids.deck), "theme")).toEqual({
      ...theme(),
      colors: { ...theme().colors, accent1: blue },
      fonts: { ...theme().fonts, heading: "Lora" },
    })
  })

  it("writes a custom theme as a value", () => {
    const source = theme()
    const custom = {
      ...source,
      fonts: { heading: "Lora", body: "Inter" },
      textStyles: { ...source.textStyles, title: { ...source.textStyles.title, size: 93 } },
    }
    const change = readIntent({ op: "deck", theme: custom })
    if ("refused" in change) throw new Error(JSON.stringify(change))
    expect(compileIntent(agentDeck(), change, minter(), placement, starts)).toEqual([
      { node: ids.deck, prop: "theme", value: custom },
    ])
  })

  it("refuses a theme name where an edit needs a theme value", () => {
    expect(readIntent({ op: "deck", theme: "toString" })).toMatchObject({ refused: "shape", field: "theme" })
  })

  it("refuses a deck change that names nothing, and a colour that is not a hex", () => {
    expect(compileIntent(agentDeck(), { op: "deck" }, minter(), placement, starts)).toMatchObject({
      refused: "shape",
    })
    expect(readIntent({ op: "deck", colors: { accent1: "accent2" } })).toMatchObject({ refused: "shape" })
    expect(readIntent({ op: "deck", colors: { brand: theme().colors.accent1 } })).toMatchObject({
      refused: "shape",
    })
  })
})
