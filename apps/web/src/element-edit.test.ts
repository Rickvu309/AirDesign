import { decide, elementId, openRegister, slideId, type Register, type SlideCommand } from "@airdesign/document"
import { readShapes } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { elementCommand } from "./element-edit"
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
