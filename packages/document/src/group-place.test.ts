import { expect, it } from "vitest"
import {
  decide,
  elementId,
  format,
  groupOf,
  openRegister,
  placeOf,
  slideId,
  type Command,
  type Register,
} from "./index.js"

const slide = slideId("256")
const file = [slide]
const circle = elementId("256.2")
const label = elementId("256.3")
const group = elementId("256.4")

function ran(register: Register, commands: readonly Command[]): Register {
  let current = register
  for (const command of commands) {
    const decision = decide(current, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    current = decision.register
  }
  return current
}

function typedLabel(): Register {
  const placed = { x: 1_000_000, y: 400_000, cx: 274_320, cy: 274_320 }
  const register = ran(openRegister("", ""), [
    {
      command: "slide",
      file,
      edit: {
        slide: "element-add",
        id: slide,
        element: {
          node: circle,
          kind: "shape",
          value: "",
          box: { x: 0, y: 400_000, cx: 400_000, cy: 400_000 },
          grouped: false,
        },
      },
    },
    {
      command: "slide",
      file,
      edit: {
        slide: "element-add",
        id: slide,
        element: { node: label, kind: "shape", value: "", box: placed, grouped: false },
      },
    },
    { command: "add", node: label, floor: "", route: "" },
    { command: "person", node: label, value: '[{"from":0,"runs":[{"from":0,"text":"Market context and sizing"}]}]' },
    { command: "person", node: label, v: format, patch: { box: { w: { set: 3_200_400 }, h: { set: 274_154 } } } },
  ])
  const body = register.elements[label]
  if (body === undefined) throw new Error("no body")
  const { floorBox: _floorBox, ...unfloored } = body
  return { ...register, elements: { ...register.elements, [label]: unfloored } }
}

it("places a text at the width its words were fitted to, when its record holds no floor box", () => {
  const register = typedLabel()
  expect(placeOf(register, label)?.box).toEqual({ x: 1_000_000, y: 400_000, cx: 3_200_400, cy: 274_154 })
})

it("groups a text around the width its words were fitted to", () => {
  const made = groupOf(typedLabel(), slide, group, [circle, label])
  expect(made?.members.find((member) => member.node === label)?.box.cx).toBe(3_200_400)
  expect(made?.element.box).toEqual({ x: 0, y: 400_000, cx: 4_200_400, cy: 400_000 })
})
