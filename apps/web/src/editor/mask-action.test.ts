import { elementId, type ElementId } from "@airdesign/document"
import type { CanvasElement } from "@airdesign/render"
import { expect, it } from "vitest"
import { maskAction } from "./mask-action"

function element(id: string, kind: CanvasElement["kind"]): CanvasElement {
  return {
    key: id,
    id: elementId(id),
    kind,
    box: null,
    editable: false,
    placeholder: false,
    filled: false,
    fill: null,
    line: null,
    outline: "box",
    text: null,
  }
}

const elements = [element("256.2", "shape"), element("256.3", "picture"), element("256.4", "group")]
const ids = (...names: string[]): readonly ElementId[] => names.map(elementId)

it("makes the back layer of the selection the mask of a new group, as Figma's Use as mask", () => {
  expect(maskAction(ids("256.3", "256.2"), elements)).toEqual({
    kind: "group",
    change: { change: "mask", nodes: ids("256.3", "256.2"), mask: elementId("256.2") },
  })
})

it("turns one selected layer's mask on or off in place", () => {
  expect(maskAction(ids("256.3"), elements)).toEqual({ kind: "toggle", node: elementId("256.3") })
})

it("makes no mask when the back layer cannot be one or nothing is selected", () => {
  expect(maskAction(ids("256.4"), elements)).toBeNull()
  expect(maskAction(ids("256.4", "256.2").slice(0, 1), elements)).toBeNull()
  expect(maskAction([], elements)).toBeNull()
})
