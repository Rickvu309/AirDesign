import {
  decide,
  elementId,
  openRegister,
  slideId,
  textOpening,
  type Geometry,
  type Register,
  type SlideCommand,
} from "@airdesign/document"
import { readShapes } from "@airdesign/pptx"
import type { PaintBox } from "@airdesign/render"
import { expect, it } from "vitest"
import { elementCommand, removalRefusal, removals } from "./element-edit"
import { exportedParts } from "./editing/exported-parts"
import { onSlide, twoBoxSlide, xml } from "./slide-fixtures"

const size = { width: 1000, height: 500 }
const file = [slideId("256")]

function landed(register: Register, edit: SlideCommand | null): Register {
  if (edit === null) throw new Error("no edit")
  const decision = decide(register, { command: "slide", file, edit })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

it("starts a new auto width text layer, one line high and one line wide, at the top left of the free room a text box takes, under the next free id, and never reuses a removed one", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const slide = { width: 12_192_000, height: 6_858_000 }
  const added = elementCommand(parts, openRegister("", ""), { change: "text", index: 0, size: slide })
  expect(added).toEqual({
    slide: "element-add",
    id: "256",
    element: {
      node: "256.4",
      kind: "shape",
      value: "",
      box: { x: 3_657_600, y: 3_017_520, cx: 274_320, cy: 274_320 },
      grouped: false,
      opening: textOpening("auto-width"),
    },
  })
  const removed = landed(landed(openRegister("", ""), added), {
    slide: "element-remove",
    id: file[0]!,
    node: elementId("256.4"),
  })
  expect(elementCommand(parts, removed, { change: "text", index: 0, size: slide })).toMatchObject({
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
  const slide = { width: 12_192_000, height: 6_858_000 }
  const title = { x: 487_680, y: 685_800, cx: 11_216_640, cy: 1_371_600 }
  const subtitle = { x: 487_680, y: 2_286_000, cx: 11_216_640, cy: 1_828_800 }
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
  const first = elementCommand(parts, openRegister("", ""), { change: "text", index: 0, size: { ...slide, elements } })
  if (first?.slide !== "element-add") throw new Error("no add")
  const box = first.element.box
  expect(box).not.toBeNull()
  if (box === null) return
  expect(box.y).toBeGreaterThanOrEqual(subtitle.y + subtitle.cy)
  expect(box.y + box.cy).toBeLessThanOrEqual(slide.height)
})

it("says why it cannot delete an animated shape and a shape inside a group, and nothing for a plain shape or a group", () => {
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
  expect(removalRefusal(grouped, register, elementId("256.9"))).toBeNull()
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

it("moves a layer to sit before a named sibling, as a drop in the layers panel does, with the order an agent sends", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const register = openRegister("", "")
  const back = elementId("256.2")
  const front = elementId("256.3")
  const dropped = elementCommand(parts, register, { change: "order", node: front, move: { before: back } })
  expect(dropped).toEqual({ slide: "element-order", id: "256", node: front, before: back, among: [back, front] })
  expect(readShapes(exportedParts(parts, landed(register, dropped))).map((shape) => shape.shape)).toEqual(["3", "2"])
  expect(elementCommand(parts, register, { change: "order", node: back, move: { before: front } })).toBeNull()
  expect(elementCommand(parts, register, { change: "order", node: back, move: { before: back } })).toBeNull()
  expect(
    elementCommand(parts, register, { change: "order", node: back, move: { before: elementId("256.7") } }),
  ).toBeNull()
})

it("adds a rectangle, an ellipse and a line on the slide under the next free id, each in the template style", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const register = openRegister("", "")
  const shape = (geometry: Geometry) => elementCommand(parts, register, { change: "shape", geometry, index: 0, size })
  expect(shape("rect")).toEqual({
    slide: "element-add",
    id: "256",
    element: { node: "256.4", kind: "shape", value: "", box: { x: 450, y: 200, cx: 100, cy: 100 }, grouped: false },
    geometry: "rect",
  })
  expect(shape("ellipse")).toMatchObject({ element: { kind: "shape", value: "" }, geometry: "ellipse" })
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

it("deletes a group with the layers inside it in one edit, and its restore brings them all back, as Figma does", () => {
  const grouped = onSlide(
    xml(
      twoBoxSlide
        .replace(
          '<p:sp><p:nvSpPr><p:cNvPr id="3"',
          '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="9" name="Matrix"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="3"',
        )
        .replace("</p:spTree>", "</p:grpSp></p:spTree>"),
    ),
  )
  const register = openRegister("", "")
  const removed = removals(grouped, register, [elementId("256.9")])
  expect(removed).toEqual({ edits: [{ slide: "element-remove", id: "256", node: "256.9" }], refused: [] })
  const gone = removed.edits.reduce(landed, register)
  expect(readShapes(exportedParts(grouped, gone)).map((shape) => shape.shape)).toEqual(["2"])
  const back = landed(gone, { slide: "element-restore", id: file[0]!, node: elementId("256.9") })
  expect(readShapes(exportedParts(grouped, back)).map((shape) => shape.shape)).toEqual(["2", "9", "3"])
})

it("writes a new text layer with no inset, as an auto width box that hugs its text, left aligned", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const added = elementCommand(parts, openRegister("", ""), {
    change: "text",
    index: 0,
    size: { width: 12_192_000, height: 6_858_000 },
  })
  const slide = new TextDecoder().decode(
    exportedParts(parts, landed(openRegister("", ""), added)).get("ppt/slides/slide1.xml"),
  )
  const shape = slide.slice(slide.indexOf('<p:cNvPr id="4"'))
  expect(shape).toContain('<a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0" wrap="none"><a:spAutoFit/></a:bodyPr>')
  expect(shape).not.toContain("algn=")
})

it("starts a clicked text layer at the point as auto width, and a dragged one as the fixed size box it framed", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const slide = { width: 12_192_000, height: 6_858_000 }
  const clicked = elementCommand(parts, openRegister("", ""), {
    change: "text",
    index: 0,
    size: slide,
    place: { x: 1_000_000, y: 2_000_000 },
  })
  expect(clicked).toMatchObject({
    element: { box: { x: 1_000_000, y: 2_000_000, cx: 274_320, cy: 274_320 }, opening: textOpening("auto-width") },
  })
  const dragged = elementCommand(parts, openRegister("", ""), {
    change: "text",
    index: 0,
    size: slide,
    place: { x: 1_000_000, y: 2_000_000, cx: 3_000_000, cy: 500_000 },
  })
  expect(dragged).toMatchObject({
    element: { box: { x: 1_000_000, y: 2_000_000, cx: 3_000_000, cy: 500_000 }, opening: textOpening("fixed") },
  })
})
