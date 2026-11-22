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

it("gives a layer in a nested group its top group, the groups between to follow, and its own parent to step into", () => {
  const painted = canvasOf([
    row("9", { kind: "p:grpSp" }),
    row("6", { kind: "p:grpSp", group: "9" }),
    row("4", { group: "6" }),
    row("8", { group: "9" }),
  ])
  expect(painted.map((each) => [each.id, each.group?.id ?? null, each.parent ?? null])).toEqual([
    [elementId("256.9"), null, null],
    [elementId("256.6"), elementId("256.9"), elementId("256.9")],
    [elementId("256.4"), elementId("256.9"), elementId("256.6")],
    [elementId("256.8"), elementId("256.9"), elementId("256.9")],
  ])
  expect(painted.map((each) => each.nestedIn?.map((holder) => holder.id) ?? [])).toEqual([
    [],
    [],
    [elementId("256.6")],
    [],
  ])
})
