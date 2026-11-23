import { expect, it } from "vitest"
import { panelOrder, panelSections } from "./panel-order"

it("puts alignment first for a text box", () => {
  expect(panelOrder.text[0]).toBe("alignment")
})

it("orders each kind's sections", () => {
  expect(panelSections("text")).toEqual(["alignment", "text", "link", "textFill", "opacity"])
  expect(panelSections("shape")).toEqual([
    "alignment",
    "fills",
    "opacity",
    "corners",
    "border",
    "shadow",
    "selectionColors",
    "geometry",
  ])
  expect(panelSections("picture")).toEqual(["alignment", "pictureFill", "opacity", "corners", "border", "shadow"])
  expect(panelSections("connector")).toEqual(["alignment", "border", "shadow"])
  expect(panelSections("many")).toEqual([
    "alignment",
    "text",
    "textFill",
    "fills",
    "opacity",
    "link",
    "corners",
    "border",
    "shadow",
    "selectionColors",
  ])
  expect(panelSections("slide")).toEqual(["templateStyle", "background", "selectionColors"])
})
