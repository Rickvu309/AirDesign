import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { liveBox } from "./live-box.js"
import type { PaintBox } from "./paint-box.js"
import type { CanvasElement } from "./record.js"
import { paintStore } from "./store.js"

const outer = elementId("7.2")
const inner = elementId("7.3")
const leaf = elementId("7.4")

const painted = (x: number, y: number, width: number, height: number): PaintBox => ({
  x,
  y,
  width,
  height,
  rotation: 0,
  flipH: false,
  flipV: false,
})

const outerBox = painted(100, 100, 400, 300)
const innerBox = painted(150, 150, 200, 100)
const leafBox = painted(160, 160, 50, 50)

const leafElement: CanvasElement = {
  key: "ppt/slides/slide7.xml#4",
  id: leaf,
  kind: "shape",
  box: leafBox,
  editable: false,
  movable: false,
  placeholder: false,
  filled: true,
  fill: null,
  line: null,
  outline: "box",
  text: null,
  group: { id: outer, box: outerBox },
  parent: inner,
  nestedIn: [{ id: inner, box: innerBox }],
}

describe("a layer two groups deep while a group above it is dragged", () => {
  it("rests where it is painted while nothing above it moves", () => {
    expect(liveBox(paintStore(), leafElement)).toEqual(leafBox)
  })

  it("follows the inner group when only the inner group moves", () => {
    const store = paintStore()
    store.placeBox(inner, { x: 230, y: 190, cx: 200, cy: 100 })
    expect(liveBox(store, leafElement)).toMatchObject({ x: 240, y: 200, width: 50, height: 50 })
  })

  it("follows the outer group when only the outer group moves", () => {
    const store = paintStore()
    store.placeBox(outer, { x: 110, y: 130, cx: 400, cy: 300 })
    expect(liveBox(store, leafElement)).toMatchObject({ x: 170, y: 190, width: 50, height: 50 })
  })
})
