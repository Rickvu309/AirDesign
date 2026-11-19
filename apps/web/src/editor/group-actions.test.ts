import { decide, openRegister, slideId, type Command, type Register } from "@airdesign/document"
import { indexPackage } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { elementCommand } from "@/element-edit"
import { groupCommands } from "@/editor/group-actions"
import { onSlide, twoBoxSlide, xml } from "@/slide-fixtures"

const size = { width: 1000, height: 500 }
const file = [slideId("256")]

function ran(register: Register, commands: readonly Command[]): Register {
  let current = register
  for (const command of commands) {
    const decision = decide(current, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    current = decision.register
  }
  return current
}

it("groups two added shapes and ungroups them with each child's place", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const { slides, elements } = indexPackage(parts)
  let register: Register = {
    ...openRegister("", ""),
    index: { total: elements.length, slides, elements, pages: [{ once: "page", offset: 0, count: elements.length }] },
  }
  for (const geometry of ["rect", "ellipse"] as const) {
    const edit = elementCommand(parts, register, { change: "shape", geometry, index: 0, size })
    if (edit === null) throw new Error("add")
    register = ran(register, [{ command: "slide", file, edit }])
  }
  const grouped = groupCommands(parts, register, { change: "group", nodes: ["256.4", "256.5"] as never })
  expect(grouped?.[0]).toMatchObject({ command: "slide", edit: { slide: "element-group", element: { node: "256.6" } } })
  const after = ran(register, grouped ?? [])
  expect(groupCommands(parts, after, { change: "ungroup", node: "256.6" as never })?.[0]).toMatchObject({
    edit: { slide: "element-ungroup", node: "256.6" },
  })
})

it("wraps added shapes in an auto layout frame with its backdrop on the next free shape id", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const { slides, elements } = indexPackage(parts)
  let register: Register = {
    ...openRegister("", ""),
    index: { total: elements.length, slides, elements, pages: [{ once: "page", offset: 0, count: elements.length }] },
  }
  for (const geometry of ["rect", "ellipse"] as const) {
    const edit = elementCommand(parts, register, { change: "shape", geometry, index: 0, size })
    if (edit === null) throw new Error("add")
    register = ran(register, [{ command: "slide", file, edit }])
  }
  const framed = groupCommands(parts, register, { change: "frame", nodes: ["256.4", "256.5"] as never })
  expect(framed?.[0]).toMatchObject({
    command: "slide",
    edit: { slide: "element-group", element: { node: "256.6" }, backdrop: { node: "256.7", kind: "shape" } },
  })
  const after = ran(register, framed ?? [])
  expect(groupCommands(parts, after, { change: "frame", nodes: ["256.4"] as never })).toBeNull()
})
