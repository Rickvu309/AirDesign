import { describe, expect, it } from "vitest"
import { block, label, measure, plainTheme, spot } from "./doom-fixtures-art.js"
import { type TreeNode, doomFromTree } from "./doom-tree.js"
import { layoutFindings, touchedSlides, unmeasuredTexts } from "./layout-findings.js"

const filled = { fills: [{ kind: "solid", color: { var: "accent1" } }] }
const fixed = { resize: "fixed" } as const

function found(children: readonly TreeNode[]) {
  const grown = doomFromTree({ theme: plainTheme, slides: [{ children }] })
  return { ids: grown.ids, findings: layoutFindings(grown.doom, grown.slides, measure) }
}

describe("layout findings: what a slide paints wrong, measured with the deck's fonts", () => {
  it("names a fixed box too short for its words, with the height the words need", () => {
    const { ids, findings } = found([label("title", "aaaa bbbb cccc dddd", { box: spot(100, 100, 200, 30) }, fixed)])
    expect(findings).toEqual([
      {
        code: "overflow",
        node: ids.title,
        need: 60,
        room: 30,
        note: `${ids.title}: its words need 60 px of height and its box holds 30, so they spill out; make the box at least 60 tall or cut words.`,
      },
    ])
  })

  it("finds no overflow in a box that grows with its words", () => {
    expect(found([label("title", "aaaa bbbb cccc dddd", { box: spot(100, 100, 200, 30) })]).findings).toEqual([])
  })

  it("names words that run into a layer painted over them, where they meet", () => {
    const { ids, findings } = found([
      label("title", "aaaa bbbb cccc dddd", { box: spot(100, 100, 200, 60) }),
      block("chart", 300, 200, { box: spot(100, 140, 300, 200), ...filled }),
    ])
    expect(findings).toEqual([
      {
        code: "overlap",
        node: ids.title,
        with: ids.chart,
        area: { x: 100, y: 140, w: 44, h: 15 },
        note: `${ids.title}: its words and ${ids.chart} overlap over 44x15 px at 100,140; move one clear of the other.`,
      },
    ])
  })

  it("names words laid over part of a layer below them, but not words that sit inside a card", () => {
    const over = found([
      block("chart", 300, 200, { box: spot(100, 140, 300, 200), ...filled }),
      label("title", "aaaa bbbb cccc dddd", { box: spot(100, 100, 200, 60) }),
    ])
    expect(over.findings).toMatchObject([{ code: "overlap", node: over.ids.title, with: over.ids.chart }])
    const inside = found([
      block("card", 400, 300, { box: spot(50, 50, 400, 300), ...filled }),
      label("title", "aaaa bbbb", { box: spot(100, 100, 200, 60) }),
    ])
    expect(inside.findings).toEqual([])
  })

  it("measures words by their ink, so a short word in a wide box does not meet a layer beside it", () => {
    const { findings } = found([
      label("title", "Q3", { box: spot(100, 100, 1000, 30) }),
      block("chart", 300, 200, { box: spot(400, 100, 300, 200), ...filled }),
    ])
    expect(findings).toEqual([])
  })

  it("measures a line by its letters' em box, so the spacing under a last line may touch the layer below", () => {
    const { findings } = found([
      label("title", "aaaa bbbb", { box: spot(100, 100, 200, 30) }),
      block("chart", 300, 200, { box: spot(100, 126, 300, 200), ...filled }),
    ])
    expect(findings).toEqual([])
  })

  it("names two texts whose words cross", () => {
    const { ids, findings } = found([
      label("one", "aaaa bbbb", { box: spot(100, 100, 200, 30) }),
      label("two", "cccc dddd", { box: spot(150, 110, 200, 30) }),
    ])
    expect(findings).toMatchObject([{ code: "overlap", node: ids.one, with: ids.two }])
  })

  it("names a layer that runs past the slide's edge, by how far", () => {
    const { ids, findings } = found([block("photo", 200, 100, { box: spot(1850, 500, 200, 100), ...filled })])
    expect(findings).toEqual([
      {
        code: "off-slide",
        node: ids.photo,
        past: 130,
        note: `${ids.photo}: it runs 130 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
  })

  it("names text under the smallest size a room can read on this slide", () => {
    const { ids, findings } = found([
      label("note", "fine print", { box: spot(100, 900, 400, 40) }, { spans: [{ end: 10, size: 14 }] }),
    ])
    expect(findings).toEqual([
      {
        code: "small-text",
        node: ids.note,
        size: 14,
        min: 20,
        note: `${ids.note}: text at 14 px is under the 20 px a room can read on this slide.`,
      },
    ])
  })

  it("finds nothing on a slide whose layers sit clear of each other and of the edges", () => {
    expect(
      found([
        label("title", "Revenue grew", { box: spot(100, 80, 1700, 60) }),
        block("chart", 800, 600, { box: spot(100, 200, 800, 600), ...filled }),
        label("note", "Margin held", { box: spot(1000, 200, 800, 60) }),
      ]).findings,
    ).toEqual([])
  })

  it("lays out every slide again for a deck write that moves words, and none for a rename", () => {
    const grown = doomFromTree({ theme: plainTheme, slides: [{ children: [] }, { children: [] }] })
    const deck = [...grown.doom.nodes.values()].find((node) => node.type === "deck")!.id
    expect(touchedSlides(grown.doom, grown.doom, [{ node: deck, prop: "theme.fonts.body" }])).toEqual(grown.slides)
    expect(touchedSlides(grown.doom, grown.doom, [{ node: deck, prop: "name" }])).toEqual([])
    expect(touchedSlides(grown.doom, grown.doom, [{ node: deck, prop: "theme.colors.accent1" }])).toEqual([])
  })

  it("leaves out only the words its fonts have no letters for, and still judges their box", () => {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            label("emoji", "aaaa bbbb cccc dddd 🚀", { box: spot(100, 100, 200, 30) }, { resize: "fixed" }),
            block("chart", 300, 200, { box: spot(100, 110, 300, 200), ...filled }),
            label("edge", "x 🚀", { box: spot(1850, 900, 200, 30) }, { spans: [{ end: 4, size: 14 }] }),
            label("plain", "aaaa bbbb cccc dddd", { box: spot(600, 100, 200, 30) }, { resize: "fixed" }),
          ],
        },
      ],
    })
    const findings = layoutFindings(grown.doom, grown.slides, measure, new Set(["🚀"]))
    expect(findings.map((found) => [found.code, found.node])).toEqual([
      ["small-text", grown.ids.edge],
      ["overflow", grown.ids.plain],
      ["off-slide", grown.ids.edge],
    ])
    expect(unmeasuredTexts(grown.doom, grown.slides, new Set(["🚀"]))).toEqual([grown.ids.emoji, grown.ids.edge])
  })
})
