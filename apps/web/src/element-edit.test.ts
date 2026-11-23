import {
  decide,
  elementId,
  openRegister,
  slideId,
  textOpening,
  type Register,
  type SlideCommand,
} from "@airdesign/document"
import type { PaintBox } from "@airdesign/render"
import { expect, it } from "vitest"
import { elementCommand, removalRefusal } from "./element-edit"
import { onSlide, twoBoxSlide, xml } from "@/testing/slide-fixtures"

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
