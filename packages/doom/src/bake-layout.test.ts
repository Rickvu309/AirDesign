import { describe, expect, it } from "vitest"
import { type Doom, type Layout, type NodeId, bakeLayout, solveLayout } from "./index.js"
import { block, column, label, measure, padding, plainTheme, row, spot } from "./testing/doom-fixtures-art.js"
import { type TreeNode, doomFromTree } from "./doom-tree.js"
import { land } from "./sample-deck.js"
import { propOf } from "./doom-walk.js"

function grown(children: readonly TreeNode[]) {
  const made = doomFromTree({ theme: plainTheme, slides: [{ children }] })
  const id = (name: string): NodeId => made.ids[name]!
  const boxes = (doom: Doom) => solveLayout(doom, made.slides[0]!, measure)
  return { ...made, id, boxes }
}

const hugging = (children: readonly TreeNode[], layout: Layout = row({}, 10, padding(20))): TreeNode => ({
  type: "frame",
  name: "frame",
  props: { box: spot(100, 50, 1, 1), layout, sizing: { w: "hug", h: "hug" } },
  children,
})

describe("bakeLayout", () => {
  it("keeps a hugging frame and its children where auto layout put them", () => {
    const deck = grown([hugging([block("a", 100, 50), block("b", 120, 80), label("words", "Hello")])])
    const before = deck.boxes(deck.doom)
    const baked = land(deck.doom, bakeLayout(deck.doom, deck.id("frame"), measure))
    expect(propOf(baked.nodes.get(deck.id("frame"))!, "layout")).toEqual({ mode: "none" })
    const after = deck.boxes(baked)
    for (const name of ["frame", "a", "b", "words"]) expect(after.get(deck.id(name))).toEqual(before.get(deck.id(name)))
  })

  it("is the fault it fixes: writing only the layout collapses the frame", () => {
    const deck = grown([hugging([block("a", 100, 50), block("b", 120, 80)])])
    const before = deck.boxes(deck.doom)
    const bare = deck.boxes(land(deck.doom, [{ node: deck.id("frame"), prop: "layout", value: { mode: "none" } }]))
    expect(bare.get(deck.id("b"))).not.toEqual(before.get(deck.id("b")))
  })

  it("fixes a hugging frame's size and a filling child's size, and keeps a hugging child", () => {
    const deck = grown([
      hugging(
        [
          block("fill", 100, 40, { sizing: { w: "fill", h: "fixed" } }),
          block("wide", 300, 40),
          { ...hugging([block("inner", 60, 30)], column()), name: "nested" },
        ],
        column({}, 8, padding(10)),
      ),
    ])
    const before = deck.boxes(deck.doom)
    const writes = bakeLayout(deck.doom, deck.id("frame"), measure)
    const baked = land(deck.doom, writes)
    const sizing = (name: string) => propOf(baked.nodes.get(deck.id(name))!, "sizing")
    expect(sizing("frame")).toEqual({ w: "fixed", h: "fixed" })
    expect(sizing("fill")).toEqual({ w: "fixed", h: "fixed" })
    expect(sizing("nested")).toEqual({ w: "hug", h: "hug" })
    const after = deck.boxes(baked)
    expect(after.get(deck.id("fill"))).toEqual(before.get(deck.id("fill")))
    expect(after.get(deck.id("fill"))?.w).toBe(300)
    expect(writes.some((write) => write.node === deck.id("inner"))).toBe(false)
  })

  it("drops a grid child's cell and writes nothing a frame without auto layout does not need", () => {
    const grid: TreeNode = {
      type: "frame",
      name: "frame",
      props: {
        box: spot(0, 0, 400, 200),
        layout: { mode: "grid", columns: [{ fr: 1 }, { fr: 1 }], rows: [{ fr: 1 }], gap: 0, padding: padding(0) },
      },
      children: [block("a", 10, 10, { cell: { row: 0, col: 1 } })],
    }
    const deck = grown([grid])
    const baked = land(deck.doom, bakeLayout(deck.doom, deck.id("frame"), measure))
    expect(propOf(baked.nodes.get(deck.id("a"))!, "cell")).toBeUndefined()
    expect(deck.boxes(baked).get(deck.id("a"))).toMatchObject({ x: 200, y: 0, w: 10, h: 10 })
    expect(bakeLayout(baked, deck.id("frame"), measure)).toEqual([])
  })
})
