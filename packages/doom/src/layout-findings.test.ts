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

  it("names words a quarter turn carries onto a layer they sat clear of", () => {
    const flat = found([
      label("title", "aaaa bbbb", { box: spot(400, 400, 220, 30) }),
      block("chart", 40, 40, { box: spot(500, 300, 40, 40), ...filled }),
    ])
    expect(flat.findings).toEqual([])
    const sideways = { ...spot(400, 400, 220, 30), rotation: 90 }
    const turned = found([
      label("title", "aaaa bbbb", { box: sideways }),
      block("chart", 40, 40, { box: spot(500, 300, 40, 40), ...filled }),
    ])
    expect(turned.findings).toEqual([
      {
        code: "overlap",
        node: turned.ids.title,
        with: turned.ids.chart,
        area: { x: 500, y: 305, w: 20, h: 35 },
        note: `${turned.ids.title}: its words and ${turned.ids.chart} overlap over 20x35 px at 500,305; move one clear of the other.`,
      },
    ])
  })

  it("finds nothing when a quarter turn carries words clear of a layer, or keeps them inside a card", () => {
    const beside = found([
      label("title", "aaaa bbbb", { box: spot(400, 400, 220, 30) }),
      block("chart", 80, 20, { box: spot(400, 405, 80, 20), ...filled }),
    ])
    expect(beside.findings).toMatchObject([{ code: "overlap", node: beside.ids.title, with: beside.ids.chart }])
    const sideways = { ...spot(400, 400, 220, 30), rotation: 90 }
    expect(
      found([
        label("title", "aaaa bbbb", { box: sideways }),
        block("chart", 80, 20, { box: spot(400, 405, 80, 20), ...filled }),
      ]).findings,
    ).toEqual([])
    expect(
      found([
        block("card", 600, 400, { box: spot(200, 200, 600, 400), ...filled }),
        label("title", "aaaa bbbb", { box: sideways }),
      ]).findings,
    ).toEqual([])
  })

  it("names words a turn of 45, 90 or 180 degrees carries onto a layer they sat clear of", () => {
    const words = (rotation: number) =>
      label("title", "aaaa bbbb", { box: { ...spot(400, 400, 400, 100), rotation } }, fixed)
    const chart = (at: ReturnType<typeof spot>) => block("chart", at.w, at.h, { box: at, ...filled })
    for (const at of [spot(620, 250, 40, 100), spot(700, 470, 100, 40), spot(520, 290, 40, 60)])
      expect(found([words(0), chart(at)]).findings).toEqual([])
    const quarter = found([words(90), chart(spot(620, 250, 40, 100))])
    expect(quarter.findings).toEqual([
      {
        code: "overlap",
        node: quarter.ids.title,
        with: quarter.ids.chart,
        area: { x: 625, y: 250, w: 20, h: 99 },
        note: `${quarter.ids.title}: its words and ${quarter.ids.chart} overlap over 20x99 px at 625,250; move one clear of the other.`,
      },
    ])
    const half = found([words(180), chart(spot(700, 470, 100, 40))])
    expect(half.findings).toEqual([
      {
        code: "overlap",
        node: half.ids.title,
        with: half.ids.chart,
        area: { x: 701, y: 475, w: 99, h: 20 },
        note: `${half.ids.title}: its words and ${half.ids.chart} overlap over 99x20 px at 701,475; move one clear of the other.`,
      },
    ])
    const slant = found([words(45), chart(spot(520, 290, 40, 60))])
    expect(slant.findings).toEqual([
      {
        code: "overlap",
        node: slant.ids.title,
        with: slant.ids.chart,
        area: { x: 520, y: 290, w: 40, h: 60 },
        note: `${slant.ids.title}: its words and ${slant.ids.chart} overlap over 40x60 px at 520,290; move one clear of the other.`,
      },
    ])
  })

  it("names words an off-centre turn carries onto a layer, in the one direction they go", () => {
    const turned = (rotation: number) =>
      found([
        label("title", "aaaa bbbb", { box: { ...spot(300, 300, 400, 100), rotation } }, fixed),
        block("chart", 40, 99, { box: spot(520, 150, 40, 99), ...filled }),
      ])
    const clockwise = turned(90)
    expect(clockwise.findings).toEqual([
      {
        code: "overlap",
        node: clockwise.ids.title,
        with: clockwise.ids.chart,
        area: { x: 525, y: 150, w: 20, h: 99 },
        note: `${clockwise.ids.title}: its words and ${clockwise.ids.chart} overlap over 20x99 px at 525,150; move one clear of the other.`,
      },
    ])
    expect(turned(-90).findings).toEqual([])
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

  it("names a background that misses a corner of the slide, or sits in from an edge", () => {
    const snug = found([block("backdrop", 1950, 1160, { box: spot(-40, -40, 1950, 1160), ...filled })])
    expect(snug.findings).toEqual([
      {
        code: "off-slide",
        node: snug.ids.backdrop,
        past: 40,
        note: `${snug.ids.backdrop}: it runs 40 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
    const low = found([block("backdrop", 2000, 1110, { box: spot(-40, -40, 2000, 1110), ...filled })])
    expect(low.findings).toEqual([
      {
        code: "off-slide",
        node: low.ids.backdrop,
        past: 40,
        note: `${low.ids.backdrop}: it runs 40 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
    const across = found([block("backdrop", 2000, 1160, { box: spot(10, -40, 2000, 1160), ...filled })])
    expect(across.findings).toEqual([
      {
        code: "off-slide",
        node: across.ids.backdrop,
        past: 90,
        note: `${across.ids.backdrop}: it runs 90 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
    const down = found([block("backdrop", 2000, 1160, { box: spot(-40, 10, 2000, 1160), ...filled })])
    expect(down.findings).toEqual([
      {
        code: "off-slide",
        node: down.ids.backdrop,
        past: 90,
        note: `${down.ids.backdrop}: it runs 90 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
  })

  it("names covering words that run past the edge, whether or not the fonts can read them", () => {
    const read = found([label("cover", "Revenue grew", { box: spot(-40, -40, 2000, 1160) }, fixed)])
    expect(read.findings).toEqual([
      {
        code: "off-slide",
        node: read.ids.cover,
        past: 40,
        note: `${read.ids.cover}: it runs 40 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
    const banner = found([label("banner", "Revenue grew", { box: spot(-40, -40, 2000, 1160), ...filled }, fixed)])
    expect(banner.findings).toEqual([
      {
        code: "off-slide",
        node: banner.ids.banner,
        past: 40,
        note: `${banner.ids.banner}: it runs 40 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            label("cover", "Revenue 🚀", { box: spot(-40, -40, 2000, 1160) }, fixed),
            label("banner", "Revenue 🚀", { box: spot(-40, -40, 2000, 1160), ...filled }, fixed),
          ],
        },
      ],
    })
    expect(layoutFindings(grown.doom, grown.slides, measure, new Set(["🚀"]))).toEqual([
      {
        code: "off-slide",
        node: grown.ids.cover,
        past: 40,
        note: `${grown.ids.cover}: it runs 40 px past the slide's edge, where the slide cuts it off.`,
      },
      {
        code: "off-slide",
        node: grown.ids.banner,
        past: 40,
        note: `${grown.ids.banner}: it runs 40 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
  })

  it("names a filled layer whose turn only seems to cover the slide", () => {
    const stripe = found([
      block("stripe", 2320, 100, { box: { ...spot(-200, 490, 2320, 100), rotation: 30 }, ...filled }),
    ])
    expect(stripe.findings).toEqual([
      {
        code: "off-slide",
        node: stripe.ids.stripe,
        past: 83,
        note: `${stripe.ids.stripe}: it runs 83 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
    const tilt = found([block("tilt", 1800, 1800, { box: { ...spot(60, -360, 1800, 1800), rotation: 45 }, ...filled })])
    expect(tilt.findings).toEqual([
      {
        code: "off-slide",
        node: tilt.ids.tilt,
        past: 733,
        note: `${tilt.ids.tilt}: it runs 733 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
  })

  it("names a line, and an unpainted frame, that span the slide and run past its edge", () => {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            {
              type: "shape",
              name: "diagonal",
              props: {
                geometry: {
                  kind: "line",
                  start: { x: -40, y: -40 },
                  end: { x: 1960, y: 1120 },
                  route: "straight",
                  arrows: ["none", "none"],
                },
                strokes: [{ kind: "solid", color: { var: "accent1" } }],
              },
            },
          ],
        },
      ],
    })
    expect(layoutFindings(grown.doom, grown.slides, measure)).toEqual([
      {
        code: "off-slide",
        node: grown.ids.diagonal,
        past: 40,
        note: `${grown.ids.diagonal}: it runs 40 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
    const held = found([
      {
        type: "frame",
        name: "holder",
        props: { box: spot(-40, -40, 2000, 1160) },
        children: [
          block("one", 200, 200, { box: spot(-40, -40, 200, 200), ...filled }),
          block("two", 200, 200, { box: spot(1840, 1000, 200, 200), ...filled }),
        ],
      },
    ])
    expect(held.findings).toEqual([
      {
        code: "off-slide",
        node: held.ids.holder,
        past: 40,
        note: `${held.ids.holder}: it runs 40 px past the slide's edge, where the slide cuts it off.`,
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
