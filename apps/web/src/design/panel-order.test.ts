import { expect, it } from "vitest"
import { panelOrder, panelPlaces, type PanelKind } from "./panel-order"

it("puts alignment first for a text box", () => {
  expect(panelOrder.text[0]).toEqual({ section: "alignment", open: true, mode: "slides" })
})

it("marks the simple sections separately from the exact PowerPoint controls", () => {
  const slides = (kind: PanelKind | "slide") => panelPlaces(kind, "slides").map(({ section }) => section)

  expect(slides("text")).toEqual(["alignment", "text", "link", "textFill", "opacity"])
  expect(slides("shape")).toEqual([
    "alignment",
    "fills",
    "opacity",
    "corners",
    "border",
    "shadow",
    "selectionColors",
    "geometry",
  ])
  expect(slides("picture")).toEqual(["alignment", "pictureFill", "opacity", "corners", "border", "shadow"])
  expect(slides("connector")).toEqual(["alignment", "border", "shadow"])
  expect(slides("many")).toEqual([
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
  expect(slides("slide")).toEqual(["templateStyle", "background", "selectionColors"])
})
