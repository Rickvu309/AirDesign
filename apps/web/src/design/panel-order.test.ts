import { expect, it } from "vitest"
import { panelOrder, panelSections } from "./panel-order"

it("puts alignment first for a text box", () => {
  expect(panelOrder.text[0]).toBe("alignment")
})

it("orders each kind's sections", () => {
  expect(panelSections("text")).toEqual(["alignment", "text", "link", "textFill"])
  expect(panelSections("shape")).toEqual(["alignment", "fills", "border", "selectionColors", "geometry"])
  expect(panelSections("picture")).toEqual(["alignment", "pictureFill", "border"])
  expect(panelSections("connector")).toEqual(["alignment", "border"])
  expect(panelSections("many")).toEqual(["alignment", "text", "textFill", "fills", "link", "border", "selectionColors"])
  expect(panelSections("slide")).toEqual(["templateStyle", "background", "source", "selectionColors"])
})
