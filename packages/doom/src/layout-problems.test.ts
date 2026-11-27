import { describe, expect, it } from "vitest"
import { rules } from "./testing/problem-rules.js"
import { block, label, measure, plainTheme, spot } from "./testing/doom-fixtures-art.js"
import { type TreeNode, doomFromTree } from "./doom-tree.js"
import { layoutProblems, touchedSlides, unmeasuredTexts } from "./layout-problems.js"

const filled = { fills: [{ kind: "solid", color: { var: "accent1" } }] }
const fixed = { resize: "fixed" } as const

function found(children: readonly TreeNode[]) {
  const grown = doomFromTree({ theme: plainTheme, slides: [{ children }] })
  return { ids: grown.ids, problems: layoutProblems(grown.doom, grown.slides, measure, rules) }
}

describe("layout problems: what a slide paints wrong, measured with the deck's fonts", () => {
  it("names a fixed box too short for its words, with the height the words need", () => {
    const { ids, problems } = found([label("title", "aaaa bbbb cccc dddd", { box: spot(100, 100, 200, 30) }, fixed)])
    expect(problems).toEqual([
      {
        code: "overflow",
        node: ids.title,
        need: 60,
        room: 30,
      },
    ])
  })

  it.each([
    ["wide", "WWWWWWWWWWWWWWWWWWWW", 200, 60, { wrap: "none" }, "w"],
    ["tall", "aaaa bbbb cccc dddd", 200, 30, {}, "h"],
  ] as const)("names the side a %s shortened label was cut on", (_, chars, w, h, text, side) => {
    const { problems } = found([
      label("title", chars, { box: spot(100, 100, w, h) }, { ...fixed, ...text, overflow: "ellipsis" }),
    ])
    expect(problems).toEqual([expect.objectContaining({ code: "overflow", ellipsis: side })])
  })

  it("finds no overflow in a box that grows with its words", () => {
    expect(found([label("title", "aaaa bbbb cccc dddd", { box: spot(100, 100, 200, 30) })]).problems).toEqual([])
  })

  it("names words that run into a layer painted over them, where they meet", () => {
    const { ids, problems } = found([
      label("title", "aaaa bbbb cccc dddd", { box: spot(100, 100, 200, 60) }),
      block("chart", 300, 200, { box: spot(100, 140, 300, 200), ...filled }),
    ])
    expect(problems).toEqual([
      {
        code: "overlap",
        node: ids.title,
        with: ids.chart,
        area: { x: 100, y: 140, w: 44, h: 15 },
      },
    ])
  })

  it("names words laid over part of a layer below them, but not words that sit inside a card", () => {
    const over = found([
      block("chart", 300, 200, { box: spot(100, 140, 300, 200), ...filled }),
      label("title", "aaaa bbbb cccc dddd", { box: spot(100, 100, 200, 60) }),
    ])
    expect(over.problems).toMatchObject([{ code: "overlap", node: over.ids.title, with: over.ids.chart }])
    const inside = found([
      block("card", 400, 300, { box: spot(50, 50, 400, 300), ...filled }),
      label("title", "aaaa bbbb", { box: spot(100, 100, 200, 60) }),
    ])
    expect(inside.problems).toEqual([])
  })

  it("measures words by their ink, so a short word in a wide box does not meet a layer beside it", () => {
    const { problems } = found([
      label("title", "Q3", { box: spot(100, 100, 1000, 30) }),
      block("chart", 300, 200, { box: spot(400, 100, 300, 200), ...filled }),
    ])
    expect(problems).toEqual([])
  })

  it("measures a line by its letters' em box, so the spacing under a last line may touch the layer below", () => {
    const { problems } = found([
      label("title", "aaaa bbbb", { box: spot(100, 100, 200, 30) }),
      block("chart", 300, 200, { box: spot(100, 126, 300, 200), ...filled }),
    ])
    expect(problems).toEqual([])
  })

  it("names two texts whose words cross", () => {
    const { ids, problems } = found([
      label("one", "aaaa bbbb", { box: spot(100, 100, 200, 30) }),
      label("two", "cccc dddd", { box: spot(150, 110, 200, 30) }),
    ])
    expect(problems).toMatchObject([{ code: "overlap", node: ids.one, with: ids.two }])
  })

  it("names words a quarter turn carries onto a layer they sat clear of", () => {
    const flat = found([
      label("title", "aaaa bbbb", { box: spot(400, 400, 220, 30) }),
      block("chart", 40, 40, { box: spot(500, 300, 40, 40), ...filled }),
    ])
    expect(flat.problems).toEqual([])
    const sideways = { ...spot(400, 400, 220, 30), rotation: 90 }
    const turned = found([
      label("title", "aaaa bbbb", { box: sideways }),
      block("chart", 40, 40, { box: spot(500, 300, 40, 40), ...filled }),
    ])
    expect(turned.problems).toEqual([
      {
        code: "overlap",
        node: turned.ids.title,
        with: turned.ids.chart,
        area: { x: 500, y: 305, w: 20, h: 35 },
      },
    ])
  })

  it("finds nothing when a quarter turn carries words clear of a layer, or keeps them inside a card", () => {
    const beside = found([
      label("title", "aaaa bbbb", { box: spot(400, 400, 220, 30) }),
      block("chart", 80, 20, { box: spot(400, 405, 80, 20), ...filled }),
    ])
    expect(beside.problems).toMatchObject([{ code: "overlap", node: beside.ids.title, with: beside.ids.chart }])
    const sideways = { ...spot(400, 400, 220, 30), rotation: 90 }
    expect(
      found([
        label("title", "aaaa bbbb", { box: sideways }),
        block("chart", 80, 20, { box: spot(400, 405, 80, 20), ...filled }),
      ]).problems,
    ).toEqual([])
    expect(
      found([
        block("card", 600, 400, { box: spot(200, 200, 600, 400), ...filled }),
        label("title", "aaaa bbbb", { box: sideways }),
      ]).problems,
    ).toEqual([])
  })

  it("names words a turn of 45, 90 or 180 degrees carries onto a layer they sat clear of", () => {
    const words = (rotation: number) =>
      label("title", "aaaa bbbb", { box: { ...spot(400, 400, 400, 100), rotation } }, fixed)
    const chart = (at: ReturnType<typeof spot>) => block("chart", at.w, at.h, { box: at, ...filled })
    for (const at of [spot(620, 250, 40, 100), spot(700, 470, 100, 40), spot(520, 290, 40, 60)])
      expect(found([words(0), chart(at)]).problems).toEqual([])
    const quarter = found([words(90), chart(spot(620, 250, 40, 100))])
    expect(quarter.problems).toEqual([
      {
        code: "overlap",
        node: quarter.ids.title,
        with: quarter.ids.chart,
        area: { x: 625, y: 250, w: 20, h: 99 },
      },
    ])
    const half = found([words(180), chart(spot(700, 470, 100, 40))])
    expect(half.problems).toEqual([
      {
        code: "overlap",
        node: half.ids.title,
        with: half.ids.chart,
        area: { x: 701, y: 475, w: 99, h: 20 },
      },
    ])
    const slant = found([words(45), chart(spot(520, 290, 40, 60))])
    expect(slant.problems).toEqual([
      {
        code: "overlap",
        node: slant.ids.title,
        with: slant.ids.chart,
        area: { x: 520, y: 290, w: 40, h: 60 },
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
    expect(clockwise.problems).toEqual([
      {
        code: "overlap",
        node: clockwise.ids.title,
        with: clockwise.ids.chart,
        area: { x: 525, y: 150, w: 20, h: 99 },
      },
    ])
    expect(turned(-90).problems).toEqual([])
  })

  it("names words a turned frame carries onto a layer, where that turn paints an off-centre child", () => {
    const frame = (rotation: number) => ({
      type: "frame" as const,
      name: "card",
      props: { box: { ...spot(300, 200, 400, 200), rotation } },
      children: [label("title", "aaaa bbbb", { box: spot(20, 20, 220, 30) })],
    })
    const chart = (at: ReturnType<typeof spot>) => block("chart", at.w, at.h, { box: at, ...filled })
    const flat = found([frame(0), chart(spot(555, 120, 40, 40))])
    expect(flat.problems).toEqual([])
    const carried = found([frame(90), chart(spot(555, 120, 40, 40))])
    expect(carried.problems).toEqual([
      {
        code: "overlap",
        node: carried.ids.card,
        with: carried.ids.chart,
        area: { x: 555, y: 120, w: 20, h: 40 },
      },
    ])
    const stayed = found([frame(0), chart(spot(320, 225, 40, 20))])
    expect(stayed.problems).toEqual([
      {
        code: "overlap",
        node: stayed.ids.card,
        with: stayed.ids.chart,
        area: { x: 320, y: 225, w: 40, h: 20 },
      },
    ])
    expect(found([frame(90), chart(spot(320, 225, 40, 20))]).problems).toEqual([])
  })

  it("names an overlap inside a frame where that frame's parent turn paints it", () => {
    const frame = (rotation: number) => ({
      type: "frame" as const,
      name: "card",
      props: { box: { ...spot(300, 200, 400, 200), rotation } },
      children: [
        {
          type: "frame" as const,
          name: "holder",
          props: { box: spot(0, 0, 400, 200) },
          children: [
            label("title", "aaaa bbbb", { box: spot(20, 20, 220, 30) }),
            block("chart", 40, 20, { box: spot(20, 25, 40, 20), ...filled }),
          ],
        },
      ],
    })
    const flat = found([frame(0)])
    expect(flat.problems).toEqual([
      {
        code: "overlap",
        node: flat.ids.title,
        with: flat.ids.chart,
        area: { x: 320, y: 225, w: 40, h: 20 },
      },
    ])
    const turned = found([frame(90)])
    expect(turned.problems).toEqual([
      {
        code: "overlap",
        node: turned.ids.title,
        with: turned.ids.chart,
        area: { x: 555, y: 120, w: 20, h: 40 },
      },
    ])
  })

  it("names a layer that runs past the slide's edge, by how far", () => {
    const { ids, problems } = found([block("photo", 200, 100, { box: spot(1850, 500, 200, 100), ...filled })])
    expect(problems).toEqual([
      {
        code: "off-slide",
        node: ids.photo,
        past: 130,
        whole: false,
      },
    ])
  })

  it("names a background that misses a corner of the slide, or sits in from an edge", () => {
    const snug = found([block("backdrop", 1950, 1160, { box: spot(-40, -40, 1950, 1160), ...filled })])
    expect(snug.problems).toEqual([
      {
        code: "off-slide",
        node: snug.ids.backdrop,
        past: 40,
        whole: false,
      },
    ])
    const low = found([block("backdrop", 2000, 1110, { box: spot(-40, -40, 2000, 1110), ...filled })])
    expect(low.problems).toEqual([
      {
        code: "off-slide",
        node: low.ids.backdrop,
        past: 40,
        whole: false,
      },
    ])
    const across = found([block("backdrop", 2000, 1160, { box: spot(10, -40, 2000, 1160), ...filled })])
    expect(across.problems).toEqual([
      {
        code: "off-slide",
        node: across.ids.backdrop,
        past: 90,
        whole: false,
      },
    ])
    const down = found([block("backdrop", 2000, 1160, { box: spot(-40, 10, 2000, 1160), ...filled })])
    expect(down.problems).toEqual([
      {
        code: "off-slide",
        node: down.ids.backdrop,
        past: 90,
        whole: false,
      },
    ])
  })

  it("names covering words that run past the edge, whether or not the fonts can read them", () => {
    const read = found([label("cover", "Revenue grew", { box: spot(-40, -40, 2000, 1160) }, fixed)])
    expect(read.problems).toEqual([
      {
        code: "off-slide",
        node: read.ids.cover,
        past: 40,
        whole: false,
      },
    ])
    const banner = found([label("banner", "Revenue grew", { box: spot(-40, -40, 2000, 1160), ...filled }, fixed)])
    expect(banner.problems).toEqual([
      {
        code: "off-slide",
        node: banner.ids.banner,
        past: 40,
        whole: false,
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
    expect(
      layoutProblems(grown.doom, grown.slides, measure, rules, new Map([[plainTheme.fonts.body, new Set(["🚀"])]])),
    ).toEqual([
      {
        code: "off-slide",
        node: grown.ids.cover,
        past: 40,
        whole: false,
      },
      {
        code: "off-slide",
        node: grown.ids.banner,
        past: 40,
        whole: false,
      },
    ])
  })

  it("names a filled layer whose turn only seems to cover the slide", () => {
    const stripe = found([
      block("stripe", 2320, 100, { box: { ...spot(-200, 490, 2320, 100), rotation: 30 }, ...filled }),
    ])
    expect(stripe.problems).toEqual([
      {
        code: "off-slide",
        node: stripe.ids.stripe,
        past: 83,
        whole: false,
      },
    ])
    const tilt = found([block("tilt", 1800, 1800, { box: { ...spot(60, -360, 1800, 1800), rotation: 45 }, ...filled })])
    expect(tilt.problems).toEqual([
      {
        code: "off-slide",
        node: tilt.ids.tilt,
        past: 733,
        whole: false,
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
    expect(layoutProblems(grown.doom, grown.slides, measure, rules)).toEqual([
      {
        code: "off-slide",
        node: grown.ids.diagonal,
        past: 40,
        whole: false,
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
    expect(held.problems).toEqual([
      {
        code: "off-slide",
        node: held.ids.holder,
        past: 80,
        whole: false,
      },
    ])
  })

  it.each([
    [{ readable: 20, onHeight: 1080 }, 14, 20],
    [{ readable: 30, onHeight: 1080 }, 24, 30],
    [{ readable: 10, onHeight: 540 }, 14, 20],
  ])("names text under the readable size %j scaled to this slide", (readable, size, min) => {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        { children: [label("note", "fine print", { box: spot(100, 900, 400, 40) }, { spans: [{ end: 10, size }] })] },
      ],
    })
    expect(layoutProblems(grown.doom, grown.slides, measure, { ...rules, ...readable })).toEqual([
      { code: "small-text", node: grown.ids.note, size, min },
    ])
  })

  it("finds nothing on a slide whose layers sit clear of each other and of the edges", () => {
    expect(
      found([
        label("title", "Revenue grew", { box: spot(100, 80, 1700, 60) }),
        block("chart", 800, 600, { box: spot(100, 200, 800, 600), ...filled }),
        label("note", "Margin held", { box: spot(1000, 200, 800, 60) }),
      ]).problems,
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
    const problems = layoutProblems(
      grown.doom,
      grown.slides,
      measure,
      rules,
      new Map([[plainTheme.fonts.body, new Set(["🚀"])]]),
    )
    expect(problems.map((found) => [found.code, found.node])).toEqual([
      ["small-text", grown.ids.edge],
      ["overflow", grown.ids.plain],
      ["off-slide", grown.ids.edge],
    ])
    expect(unmeasuredTexts(grown.doom, grown.slides, new Map([[plainTheme.fonts.body, new Set(["🚀"])]]))).toEqual([
      grown.ids.emoji,
      grown.ids.edge,
    ])
  })
})
