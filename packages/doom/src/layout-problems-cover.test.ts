import { describe, expect, it } from "vitest"
import { block, label, measure, plainTheme, spot } from "./testing/doom-fixtures-art.js"
import { type TreeNode, doomFromTree } from "./doom-tree.js"
import type { Geometry } from "./geometry.js"
import { layoutProblems } from "./layout-problems.js"

const filled = { fills: [{ kind: "solid", color: { var: "accent1" } }] }

function found(children: readonly TreeNode[]) {
  const grown = doomFromTree({ theme: plainTheme, slides: [{ children }] })
  return { ids: grown.ids, problems: layoutProblems(grown.doom, grown.slides, measure) }
}

describe("layout problems: what may cover the slide without a word of its own", () => {
  it("finds nothing for a plain background that covers the slide, even where its box runs past the edge", () => {
    const title = () => label("title", "Revenue grew", { box: spot(100, 80, 800, 60) })
    expect(
      found([block("backdrop", 2000, 1160, { box: spot(-40, -40, 2000, 1160), ...filled }), title()]).problems,
    ).toEqual([])
    expect(
      found([block("backdrop", 1920, 1080, { box: spot(0, 0, 1920, 1080), ...filled }), title()]).problems,
    ).toEqual([])
    expect(found([block("backdrop", 2000, 1080, { box: spot(-40, 0, 2000, 1080), ...filled })]).problems).toEqual([])
    expect(
      found([block("backdrop", 2000, 1080, { box: { ...spot(-40, 0, 2000, 1080), rotation: 360 }, ...filled })])
        .problems,
    ).toEqual([])
    const rect = found([
      {
        type: "shape",
        name: "backdrop",
        props: {
          box: spot(-40, -40, 2000, 1160),
          fills: [{ kind: "solid", color: { var: "accent1" } }],
          geometry: { kind: "rect" },
        },
      },
    ])
    expect(rect.problems).toEqual([])
  })

  it("names a cover that is not one plain leaf, however plainly it covers the slide", () => {
    const holder = found([
      {
        type: "frame",
        name: "holder",
        props: { box: spot(-40, -40, 2000, 1160), fills: [{ kind: "solid", color: { var: "accent1" } }] },
        children: [
          block("one", 200, 200, { box: spot(-40, -40, 200, 200), ...filled }),
          block("two", 200, 200, { box: spot(1840, 1000, 200, 200), ...filled }),
        ],
      },
    ])
    expect(holder.problems).toEqual([
      {
        code: "off-slide",
        node: holder.ids.holder,
        past: 80,
        whole: false,
      },
    ])
    const bare = found([block("bare", 2000, 1160, { box: spot(-40, -40, 2000, 1160) })])
    expect(bare.problems).toEqual([
      {
        code: "off-slide",
        node: bare.ids.bare,
        past: 40,
        whole: false,
      },
    ])
    const clear = found([block("clear", 2000, 1160, { box: spot(-40, -40, 2000, 1160), ...filled, opacity: 0 })])
    expect(clear.problems).toEqual([
      {
        code: "off-slide",
        node: clear.ids.clear,
        past: 40,
        whole: false,
      },
    ])
    const washed = found([
      block("washed", 2000, 1160, {
        box: spot(-40, -40, 2000, 1160),
        fills: [{ kind: "solid", color: { var: "accent1" }, opacity: 0 }],
      }),
    ])
    expect(washed.problems).toEqual([
      {
        code: "off-slide",
        node: washed.ids.washed,
        past: 40,
        whole: false,
      },
    ])
    const cover = (name: string, geometry: Geometry): ReturnType<typeof found> =>
      found([
        {
          type: "shape",
          name,
          props: { box: spot(-40, -40, 2000, 1160), fills: [{ kind: "solid", color: { var: "accent1" } }], geometry },
        },
      ])
    for (const [name, geometry] of [
      ["oval", { kind: "ellipse" }],
      ["wedge", { kind: "preset", name: "triangle" }],
      ["drawn", { kind: "path", d: "M0 0 L1 0 L1 1 L0 1 Z" }],
      ["glyph", { kind: "icon", name: "lucide/star" }],
    ] as const) {
      const shaped = cover(name, geometry)
      expect(shaped.problems).toEqual([
        {
          code: "off-slide",
          node: shaped.ids[name],
          past: 40,
          whole: false,
        },
      ])
    }
  })

  it("names a turned cover that bleeds past the edge, even one that truly covers the slide", () => {
    const exact = found([
      block("exact", 1080, 1920, { box: { ...spot(420, -420, 1080, 1920), rotation: 90 }, ...filled }),
    ])
    expect(exact.problems).toEqual([])
    for (const [rotation, box] of [
      [90, spot(420, -460, 1080, 2000)],
      [270, spot(420, -460, 1080, 2000)],
      [180, spot(-40, 0, 2000, 1080)],
    ] as const) {
      const cover = found([block("cover", box.w, box.h, { box: { ...box, rotation }, ...filled })])
      expect(cover.problems).toEqual([
        {
          code: "off-slide",
          node: cover.ids.cover,
          past: 40,
          whole: false,
        },
      ])
    }
    const diamond = found([
      block("diamond", 1600, 1600, { box: { ...spot(160, -260, 1600, 1600), rotation: 45 }, ...filled }),
    ])
    expect(diamond.problems).toEqual([
      {
        code: "off-slide",
        node: diamond.ids.diamond,
        past: 591,
        whole: false,
      },
    ])
  })
})
