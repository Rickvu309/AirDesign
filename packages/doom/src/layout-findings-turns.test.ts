import { describe, expect, it } from "vitest"
import { block, label, measure, plainTheme, spot } from "./testing/doom-fixtures-art.js"
import { type TreeNode, doomFromTree } from "./doom-tree.js"
import { layoutFindings } from "./layout-findings.js"

const filled = { fills: [{ kind: "solid", color: { var: "accent1" } }] }

function found(children: readonly TreeNode[]) {
  const grown = doomFromTree({ theme: plainTheme, slides: [{ children }] })
  return { ids: grown.ids, findings: layoutFindings(grown.doom, grown.slides, measure) }
}

describe("layout findings: nested turns, judged once where the corners land", () => {
  it("names words a 30 degree frame and a 45 degree frame carry onto a layer, in either order, and stays quiet 8 px clear", () => {
    const nested = (outer: number, inner: number) => ({
      type: "frame" as const,
      name: "card",
      props: { box: { ...spot(300, 200, 400, 200), rotation: outer } },
      children: [
        {
          type: "frame" as const,
          name: "holder",
          props: { box: { ...spot(160, 40, 220, 80), rotation: inner } },
          children: [label("title", "aaaa bbbb", { box: spot(10, 10, 200, 30) })],
        },
      ],
    })
    const chart = (at: ReturnType<typeof spot>) => block("chart", at.w, at.h, { box: at, ...filled })
    const carried = found([nested(30, 45), chart(spot(540, 250, 30, 30))])
    expect(carried.findings).toEqual([
      {
        code: "overlap",
        node: carried.ids.card,
        with: carried.ids.chart,
        area: { x: 550, y: 250, w: 20, h: 30 },
        note: `${carried.ids.card}: its words and ${carried.ids.chart} overlap over 20x30 px at 550,250; move one clear of the other.`,
      },
    ])
    const swapped = found([nested(45, 30), chart(spot(533, 268, 30, 30))])
    expect(swapped.findings).toEqual([
      {
        code: "overlap",
        node: swapped.ids.card,
        with: swapped.ids.chart,
        area: { x: 543, y: 268, w: 20, h: 30 },
        note: `${swapped.ids.card}: its words and ${swapped.ids.chart} overlap over 20x30 px at 543,268; move one clear of the other.`,
      },
    ])
    expect(found([nested(30, 45), chart(spot(516, 235, 25, 20))]).findings).toEqual([])
    expect(found([nested(45, 30), chart(spot(509, 252, 25, 20))]).findings).toEqual([])
  })

  it("names a filled shape a frame holds past the slide's edge, where that frame paints it", () => {
    const held = (rotation: number) =>
      found([
        {
          type: "frame",
          name: "card",
          props: { box: { ...spot(1200, 300, 400, 200), rotation } },
          children: [block("photo", 900, 80, { box: spot(0, 60, 900, 80), ...filled })],
        },
      ])
    const plain = held(0)
    expect(plain.findings).toEqual([
      {
        code: "off-slide",
        node: plain.ids.card,
        past: 180,
        note: `${plain.ids.card}: it runs 180 px past the slide's edge, where the slide cuts it off.`,
      },
    ])
    expect(held(60).findings).toEqual([])
  })
})
