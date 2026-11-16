import {
  decide,
  elementId,
  openRegister,
  slideId,
  type Geometry,
  type Register,
  type SlideCommand,
} from "@airdesign/document"
import { readShapes } from "@airdesign/pptx"
import type { PaintBox } from "@airdesign/render"
import { expect, it } from "vitest"
import { elementCommand, removalRefusal, removals } from "./element-edit"
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
  const removed = removals(parts, register, [elementId("256.3")])
  expect(removed).toEqual({ edits: [{ slide: "element-remove", id: "256", node: "256.3" }], refused: [] })
  const shown = exportedParts(parts, removed.edits.reduce(landed, register))
  expect(readShapes(shown).map((shape) => shape.shape)).toEqual(["2"])
  expect(removals(parts, register, [elementId("256.7"), elementId("257.2")])).toEqual({ edits: [], refused: [] })
})

it("removes every element it can of several and says why it cannot remove an animated one", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const register = openRegister("", "")
  const both = removals(parts, register, [elementId("256.2"), elementId("256.3")])
  expect(both.edits.map((edit) => edit.slide === "element-remove" && edit.node)).toEqual(["256.2", "256.3"])
  expect(readShapes(exportedParts(parts, both.edits.reduce(landed, register)))).toEqual([])
  const animated = onSlide(
    xml(
      twoBoxSlide.replace(
        "</p:cSld>",
        '</p:cSld><p:timing><p:tnLst><p:par><p:cTn><p:childTnLst><p:set><p:cBhvr><p:tgtEl><p:spTgt spid="3"/></p:tgtEl></p:cBhvr></p:set></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>',
      ),
    ),
  )
  expect(removals(animated, register, [elementId("256.3"), elementId("256.2")])).toEqual({
    edits: [{ slide: "element-remove", id: "256", node: "256.2" }],
    refused: ["animated"],
  })
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

it("brings a shape to the front of its siblings and refuses a move that changes nothing", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const register = openRegister("", "")
  const back = elementId("256.2")
  const front = elementId("256.3")
  const brought = elementCommand(parts, register, { change: "order", node: back, move: "front" })
  expect(brought).toEqual({
    slide: "element-order",
    id: "256",
    node: back,
    before: null,
    among: [back, front],
  })
  expect(readShapes(exportedParts(parts, landed(register, brought))).map((shape) => shape.shape)).toEqual(["3", "2"])
  const stepped = elementCommand(parts, register, { change: "order", node: front, move: "backward" })
  expect(stepped).toEqual({ slide: "element-order", id: "256", node: front, before: back, among: [back, front] })
  expect(elementCommand(parts, register, { change: "order", node: back, move: "back" })).toBeNull()
  expect(elementCommand(parts, register, { change: "order", node: back, move: "backward" })).toBeNull()
  expect(elementCommand(parts, register, { change: "order", node: front, move: "front" })).toBeNull()
  expect(elementCommand(parts, register, { change: "order", node: front, move: "forward" })).toBeNull()
  expect(elementCommand(parts, landed(register, brought), { change: "order", node: back, move: "front" })).toBeNull()
  expect(elementCommand(parts, register, { change: "order", node: elementId("256.7"), move: "front" })).toBeNull()
})

it("adds a rectangle, an ellipse and a line on the slide under the next free id, each in the theme's style", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const register = openRegister("", "")
  const shape = (geometry: Geometry) => elementCommand(parts, register, { change: "shape", geometry, index: 0, size })
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
  expect(shape("straightConnector1")).toMatchObject({
    element: { kind: "connector", box: { cx: 300, cy: 0 } },
    geometry: "straightConnector1",
  })
  expect(shape("star5")).toMatchObject({
    element: { kind: "shape", box: { cx: 100, cy: 100 } },
    geometry: "star5",
  })
  for (const geometry of ["rect", "ellipse", "line", "straightConnector1", "star5"] as const) {
    const shown = readShapes(exportedParts(parts, landed(register, shape(geometry))))
    const connector = geometry === "line" || geometry === "straightConnector1"
    expect(shown.find((each) => each.shape === "4")?.kind).toBe(connector ? "p:cxnSp" : "p:sp")
  }
})

it("puts a new shape clear of a line the slide paints", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const line = { x: 350, y: 250, width: 300, height: 0, rotation: 0, flipH: false, flipV: false }
  const room = { ...size, elements: [{ box: line }] }
  const added = elementCommand(parts, openRegister("", ""), { change: "shape", geometry: "rect", index: 0, size: room })
  if (added === null || added.slide !== "element-add" || added.element.box === null) throw new Error("no shape")
  const { x, y, cx, cy } = added.element.box
  const clear = x + cx <= line.x || x >= line.x + line.width || y + cy <= line.y || y >= line.y + line.height
  expect(clear).toBe(true)
})
