import { describe, expect, it } from "vitest"
import { block, label, measure, plainTheme, spot } from "./testing/doom-fixtures-art.js"
import { type TreeNode, doomFromTree } from "./doom-tree.js"
import type { Geometry } from "./geometry.js"
import { layoutFindings } from "./layout-findings.js"

const filled = { fills: [{ kind: "solid", color: { var: "accent1" } }] }

function found(children: readonly TreeNode[]) {
  const grown = doomFromTree({ theme: plainTheme, slides: [{ children }] })
  return { ids: grown.ids, findings: layoutFindings(grown.doom, grown.slides, measure) }
}

describe("layout findings: what may cover the slide without a word of its own", () => {
  it("finds nothing for a plain background that covers the slide, even where its box runs past the edge", () => {
    const title = () => label("title", "Revenue grew", { box: spot(100, 80, 800, 60) })
    expect(
      found([block("backdrop", 2000, 1160, { box: spot(-40, -40, 2000, 1160), ...filled }), title()]).findings,
    ).toEqual([])
    expect(
      found([block("backdrop", 1920, 1080, { box: spot(0, 0, 1920, 1080), ...filled }), title()]).findings,
    ).toEqual([])
    expect(found([block("backdrop", 2000, 1080, { box: spot(-40, 0, 2000, 1080), ...filled })]).findings).toEqual([])
    expect(
      found([block("backdrop", 2000, 1080, { box: { ...spot(-40, 0, 2000, 1080), rotation: 360 }, ...filled })])
        .findings,
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
    expect(rect.findings).toEqual([])
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
    expect(holder.findings).toEqual([
      {
        code: "off-slide",
        node: holder.ids.holder,
        past: 80,
        note: `${holder.ids.holder}: it runs 80 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
    const bare = found([block("bare", 2000, 1160, { box: spot(-40, -40, 2000, 1160) })])
    expect(bare.findings).toEqual([
      {
        code: "off-slide",
        node: bare.ids.bare,
        past: 40,
        note: `${bare.ids.bare}: it runs 40 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
    const clear = found([block("clear", 2000, 1160, { box: spot(-40, -40, 2000, 1160), ...filled, opacity: 0 })])
    expect(clear.findings).toEqual([
      {
        code: "off-slide",
        node: clear.ids.clear,
        past: 40,
        note: `${clear.ids.clear}: it runs 40 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
    const washed = found([
      block("washed", 2000, 1160, {
        box: spot(-40, -40, 2000, 1160),
        fills: [{ kind: "solid", color: { var: "accent1" }, opacity: 0 }],
      }),
    ])
    expect(washed.findings).toEqual([
      {
        code: "off-slide",
        node: washed.ids.washed,
        past: 40,
        note: `${washed.ids.washed}: it runs 40 px past the slide's edge, where the slide cuts it off.`,
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
      expect(shaped.findings).toEqual([
        {
          code: "off-slide",
          node: shaped.ids[name],
          past: 40,
          note: `${shaped.ids[name]}: it runs 40 px past the slide's edge, where the slide cuts it off.`,
        },
      ])
    }
  })

  it("names a turned cover that bleeds past the edge, even one that truly covers the slide", () => {
    const exact = found([
      block("exact", 1080, 1920, { box: { ...spot(420, -420, 1080, 1920), rotation: 90 }, ...filled }),
    ])
    expect(exact.findings).toEqual([])
    for (const [rotation, box] of [
      [90, spot(420, -460, 1080, 2000)],
      [270, spot(420, -460, 1080, 2000)],
      [180, spot(-40, 0, 2000, 1080)],
    ] as const) {
      const cover = found([block("cover", box.w, box.h, { box: { ...box, rotation }, ...filled })])
      expect(cover.findings).toEqual([
        {
          code: "off-slide",
          node: cover.ids.cover,
          past: 40,
          note: `${cover.ids.cover}: it runs 40 px past the slide's edge, where the slide cuts it off.`,
        },
      ])
    }
    const diamond = found([
      block("diamond", 1600, 1600, { box: { ...spot(160, -260, 1600, 1600), rotation: 45 }, ...filled }),
    ])
    expect(diamond.findings).toEqual([
      {
        code: "off-slide",
        node: diamond.ids.diamond,
        past: 591,
        note: `${diamond.ids.diamond}: it runs 591 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
  })
})
