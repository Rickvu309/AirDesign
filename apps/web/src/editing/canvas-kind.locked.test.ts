import { elementId } from "@airdesign/document"
import type { PaintBox, PaintElement, PaintReader } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { slideCanvases, type CanvasSource } from "./canvas-slide"

const part = "ppt/slides/slide1.xml"
const box: PaintBox = { x: 1, y: 2, width: 3, height: 4, rotation: 0, flipH: false, flipV: false }

function row(shape: string, more: Partial<PaintElement> = {}): PaintElement {
  return {
    part,
    shape,
    from: "slide",
    kind: "p:sp",
    box,
    group: null,
    placeholder: null,
    text: null,
    fill: null,
    line: null,
    geometry: null,
    image: null,
    ...more,
  }
}

function canvasOf(rows: readonly PaintElement[]) {
  const reader: PaintReader = {
    slide: () => ({ width: 12_192_000, height: 6_858_000, elements: rows, background: null }),
  }
  const shapes = new Map(
    rows.map((each) => [
      each.shape,
      {
        id: elementId(`256.${each.shape}`),
        kind: each.kind === "p:grpSp" ? ("group" as const) : ("shape" as const),
        editable: true,
        movable: true,
      },
    ]),
  )
  const source: CanvasSource = { part, shapes }
  return slideCanvases(reader, [source])(0)?.elements ?? []
}

it("marks a locked layer locked and not movable, and a free one movable", () => {
  const [free, locked] = canvasOf([row("2"), row("3", { locked: true })])
  expect([free?.locked, free?.movable]).toEqual([undefined, true])
  expect([locked?.locked, locked?.movable]).toEqual([true, false])
})

it("locks every layer inside a locked group, as Figma does", () => {
  const painted = canvasOf([row("9", { kind: "p:grpSp", locked: true }), row("10", { group: "9" }), row("11")])
  expect(painted.map((each) => [each.id, each.locked === true])).toEqual([
    [elementId("256.9"), true],
    [elementId("256.10"), true],
    [elementId("256.11"), false],
  ])
})
