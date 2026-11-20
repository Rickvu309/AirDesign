import { elementId, type Box, type ElementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { copyBoard, copiesInPlace, copySnap, lastOffset } from "./layer-copies.js"

const one = elementId("256.2")
const two = elementId("256.3")
const copyOne = elementId("256.9")
const copyTwo = elementId("256.10")
const box = { x: 100, y: 200, cx: 300, cy: 400 }
const other = { x: 1000, y: 2000, cx: 30, cy: 40 }

describe("layer copies", () => {
  it("copies a selection in place, or by an offset, keeping each box's size", () => {
    const starts = new Map([
      [one, box],
      [two, other],
    ])
    expect(copiesInPlace(starts, { dx: 0, dy: 0 })).toEqual([
      { id: one, box },
      { id: two, box: other },
    ])
    expect(copiesInPlace(starts, { dx: 50, dy: -20 })).toEqual([
      { id: one, box: { ...box, x: 150, y: 180 } },
      { id: two, box: { ...other, x: 1050, y: 1980 } },
    ])
  })

  it("repeats the distance between the last copies and their originals only while those copies are chosen", () => {
    const boxes = new Map<ElementId, Box>([
      [one, box],
      [two, other],
      [copyOne, { ...box, x: 160, y: 150 }],
      [copyTwo, { ...other, x: 1060, y: 1950 }],
    ])
    const boxOf = (id: ElementId) => boxes.get(id) ?? null
    const last = [
      { copy: copyOne, source: one },
      { copy: copyTwo, source: two },
    ]
    expect(lastOffset([copyTwo, copyOne], last, boxOf)).toEqual({ dx: 60, dy: -50 })
    expect(lastOffset([copyOne], last, boxOf)).toEqual({ dx: 0, dy: 0 })
    expect(lastOffset([one, two], last, boxOf)).toEqual({ dx: 0, dy: 0 })
    expect(lastOffset([copyOne, copyTwo], [], boxOf)).toEqual({ dx: 0, dy: 0 })
    expect(lastOffset([copyOne, copyTwo], last, (id) => (id === one ? null : boxOf(id)))).toEqual({ dx: 0, dy: 0 })
  })

  it("lets a dragged copy snap to the layers it was copied from", () => {
    const snap = { layers: [], slide: { left: 0, top: 0, right: 10, bottom: 10 }, turns: new Map([[one, 0]]) }
    expect(copySnap(snap, new Map([[one, box]])).layers).toEqual([{ left: 100, top: 200, right: 400, bottom: 600 }])
  })

  it("tells each layer whether its original shows while a copy is dragged, and only when that changes", () => {
    const board = copyBoard()
    let heard = 0
    board.subscribe(() => {
      heard += 1
    })
    board.show([one])
    board.show([one])
    expect(board.has(one)).toBe(true)
    expect(board.has(two)).toBe(false)
    board.show([])
    expect(board.has(one)).toBe(false)
    expect(heard).toBe(2)
  })
})
