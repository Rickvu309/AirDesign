import { describe, expect, it } from "vitest"
import { copiedMove, duplicateWrites } from "./copy-writes"
import { grow, landed, paint, spot } from "./scene-fixtures"

const built = grow([{ type: "shape", name: "card", props: { box: spot(100, 100, 300, 200), fills: paint } }])
const card = built.ids.card!

describe("a copy dragged away", () => {
  const minted = () => {
    let count = 0
    return () => `copy:${String(++count)}` as never
  }

  it("lands one new layer at the dragged place and leaves the original where it was", () => {
    const copies = duplicateWrites(built.view, [card], minted())
    const after = landed(built.view, copiedMove(copies, [{ node: card, prop: "box", value: spot(160, 130, 300, 200) }]))
    const [copy] = copies.roots
    expect(after.nodes.size).toBe(built.view.nodes.size + 1)
    expect(after.nodes.get(card)).toMatchObject({ box: spot(100, 100, 300, 200) })
    expect(after.nodes.get(copy!)).toMatchObject({ box: spot(160, 130, 300, 200), fills: paint })
  })

  it("lands a plain copy when nothing moved", () => {
    const copies = duplicateWrites(built.view, [card], minted())
    expect(copiedMove(copies, [])).toEqual(copies.writes)
  })
})
