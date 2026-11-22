import type { CanvasElement, CanvasText } from "@airdesign/render"
import { expect, it } from "vitest"
import { resizedSizing } from "./resized-sizing"

const text = (fit: CanvasText["fit"], wrap: boolean): CanvasText => ({
  paragraphs: [],
  anchor: "top",
  insets: { left: 0, top: 0, right: 0, bottom: 0 },
  wrap,
  ...(fit === undefined ? {} : { fit }),
})

const layer = (words: CanvasText): CanvasElement => ({
  key: "text",
  id: null,
  kind: "shape",
  box: { x: 100, y: 200, width: 300, height: 40, rotation: 0, flipH: false, flipV: false },
  editable: true,
  placeholder: false,
  filled: false,
  fill: null,
  line: null,
  outline: "box",
  text: words,
})

it("turns text that hugs its words into fixed size when a person resizes it, and keeps a move as it is", () => {
  const resized = { x: 100, y: 200, cx: 500, cy: 40 }
  expect(resizedSizing(layer(text({ kind: "grow" }, false)), resized)).toEqual({
    sizing: {
      before: { autofit: { set: "grow" }, wrap: { set: false } },
      after: { autofit: { set: "none" }, wrap: { set: true } },
    },
  })
  expect(resizedSizing(layer(text({ kind: "grow" }, false)), { x: 900, y: 50, cx: 300, cy: 40 })).toEqual({})
  expect(resizedSizing(layer(text(undefined, true)), resized)).toEqual({})
})
