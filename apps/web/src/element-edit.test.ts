import { decide, elementId, openRegister, slideId, type Register, type SlideCommand } from "@airdesign/document"
import { readShapes } from "@airdesign/pptx"
import type { PaintBox } from "@airdesign/render"
import { expect, it } from "vitest"
import { elementCommand, removalRefusal } from "./element-edit"
import { exportedParts } from "./exported-parts"
import { onSlide, twoBoxSlide, xml } from "./slide-fixtures"

const size = { width: 1000, height: 500 }
const file = [slideId("256")]

function landed(register: Register, edit: SlideCommand | null): Register {
  if (edit === null) throw new Error("no edit")
  const decision = decide(register, { command: "slide", file, edit })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

it("centres a new text box on the slide under the next free id, and never reuses a removed one", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const added = elementCommand(parts, openRegister("", ""), { change: "text", index: 0, size })
  expect(added).toEqual({
    slide: "element-add",
    id: "256",
    element: { node: "256.4", kind: "shape", value: "", box: { x: 300, y: 220, cx: 400, cy: 60 }, grouped: false },
  })
  const removed = landed(landed(openRegister("", ""), added), {
    slide: "element-remove",
    id: file[0]!,
    node: elementId("256.4"),
  })
  expect(elementCommand(parts, removed, { change: "text", index: 0, size })).toMatchObject({
    element: { node: "256.5" },
  })
})

it("removes an element from the slide it is on and refuses one the slide does not hold", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const register = openRegister("", "")
  const removed = elementCommand(parts, register, { change: "remove", node: elementId("256.3") })
  expect(removed).toEqual({ slide: "element-remove", id: "256", node: "256.3" })
  const shown = exportedParts(parts, landed(register, removed))
  expect(readShapes(shown).map((shape) => shape.shape)).toEqual(["2"])
  expect(elementCommand(parts, register, { change: "remove", node: elementId("256.7") })).toBeNull()
  expect(elementCommand(parts, register, { change: "remove", node: elementId("257.2") })).toBeNull()
})

it("exports a slide whose typed element was then removed", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const node = elementId("256.3")
  let register = openRegister("", "")
  for (const command of [
    { command: "add", node, floor: "World", route: "" },
    { command: "person", node, value: "Typed" },
  ] as const) {
    const decision = decide(register, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    register = decision.register
  }
  const removed = landed(register, { slide: "element-remove", id: file[0]!, node })
  expect(readShapes(exportedParts(parts, removed)).map((shape) => shape.shape)).toEqual(["2"])
})

it("puts a new text box clear of the boxes the slide paints, and not on top of the box before it", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const title = { x: 100, y: 50, cx: 800, cy: 150 }
  const subtitle = { x: 100, y: 220, cx: 800, cy: 120 }
  const elements = [title, subtitle].map((box) => ({
    box: {
      x: box.x,
      y: box.y,
      width: box.cx,
      height: box.cy,
      rotation: 0,
      flipH: false,
      flipV: false,
    } satisfies PaintBox,
  }))
  const first = elementCommand(parts, openRegister("", ""), { change: "text", index: 0, size: { ...size, elements } })
  if (first?.slide !== "element-add") throw new Error("no add")
  const box = first.element.box
  expect(box).not.toBeNull()
  if (box === null) return
  expect(box.y).toBeGreaterThanOrEqual(subtitle.y + subtitle.cy)
  expect(box.y + box.cy).toBeLessThanOrEqual(size.height)
})

it("says why it cannot delete an animated shape, a group and a shape inside one, and nothing for a plain shape", () => {
  const register = openRegister("", "")
  const animated = onSlide(
    xml(
      twoBoxSlide.replace(
        "</p:cSld>",
        '</p:cSld><p:timing><p:tnLst><p:par><p:cTn><p:childTnLst><p:set><p:cBhvr><p:tgtEl><p:spTgt spid="3"/></p:tgtEl></p:cBhvr></p:set></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>',
      ),
    ),
  )
  expect(removalRefusal(animated, register, elementId("256.3"))).toBe("animated")
  expect(removalRefusal(animated, register, elementId("256.2"))).toBeNull()
  const grouped = onSlide(
    xml(
      twoBoxSlide
        .replace(
          '<p:sp><p:nvSpPr><p:cNvPr id="3"',
          '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="9"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="3"',
        )
        .replace("</p:spTree>", "</p:grpSp></p:spTree>"),
    ),
  )
  expect(removalRefusal(grouped, register, elementId("256.9"))).toBe("group")
  expect(removalRefusal(grouped, register, elementId("256.3"))).toBe("group")
  expect(removalRefusal(grouped, register, elementId("256.2"))).toBeNull()
  expect(removalRefusal(grouped, register, elementId("256.77"))).toBeNull()
})

it("adds a rectangle, an ellipse and a line on the slide under the next free id, each in the theme's style", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const register = openRegister("", "")
  const shape = (geometry: "rect" | "ellipse" | "line") =>
    elementCommand(parts, register, { change: "shape", geometry, index: 0, size })
  expect(shape("rect")).toEqual({
    slide: "element-add",
    id: "256",
    element: { node: "256.4", kind: "shape", value: null, box: { x: 450, y: 200, cx: 100, cy: 100 }, grouped: false },
    geometry: "rect",
  })
  expect(shape("ellipse")).toMatchObject({ element: { kind: "shape", value: null }, geometry: "ellipse" })
  expect(shape("line")).toEqual({
    slide: "element-add",
    id: "256",
    element: { node: "256.4", kind: "connector", value: null, box: { x: 350, y: 250, cx: 300, cy: 0 }, grouped: false },
    geometry: "line",
  })
  for (const geometry of ["rect", "ellipse", "line"] as const) {
    const shown = readShapes(exportedParts(parts, landed(register, shape(geometry))))
    expect(shown.find((each) => each.shape === "4")?.kind).toBe(geometry === "line" ? "p:cxnSp" : "p:sp")
  }
})
