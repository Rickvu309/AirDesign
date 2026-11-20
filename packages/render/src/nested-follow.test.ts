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

describe("an auto layout frame while a side handle resizes it", () => {
  const frameBox = painted(100, 100, 200, 60)
  const carry = { id: outer, box: frameBox, frame: "auto" as const }
  const { nestedIn: _, ...loose } = leafElement
  const backdrop: CanvasElement = { ...loose, id: inner, box: frameBox, backdrop: true, group: carry, parent: outer }
  const child: CanvasElement = { ...loose, box: painted(100, 100, 80, 60), group: carry, parent: outer }

  it("grows its fill with the frame and keeps its layers' sizes", () => {
    const store = paintStore()
    store.placeBox(outer, { x: 100, y: 100, cx: 320, cy: 60 })
    expect(liveBox(store, backdrop)).toMatchObject({ x: 100, y: 100, width: 320, height: 60 })
    expect(liveBox(store, child)).toMatchObject({ x: 100, y: 100, width: 80, height: 60 })
  })

  it("paints a layer where the frame's live layout lays it, then follows the frame again once that layout is cleared", () => {
    const store = paintStore()
    store.placeBox(outer, { x: 80, y: 100, cx: 340, cy: 60 })
    const laid = new Map([[leaf, { x: 200, y: 100, cx: 140, cy: 60 }]])
    store.lay(laid)
    expect(liveBox(store, child)).toMatchObject({ x: 200, y: 100, width: 140, height: 60 })
    store.lay(null)
    expect(liveBox(store, child)).toMatchObject({ x: 80, y: 100, width: 80, height: 60 })
  })
})
