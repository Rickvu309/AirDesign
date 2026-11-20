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

it("wraps added shapes in an auto layout frame with its backdrop on the next free shape id, and a child of it in a frame inside it", () => {
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
  expect(groupCommands(parts, after, { change: "frame", nodes: ["256.4"] as never })?.[0]).toMatchObject({
    command: "slide",
    edit: { slide: "element-group", element: { node: "256.8" }, members: [{ node: "256.4" }] },
  })
})

it("wraps added shapes in a plain frame with flow none and a backdrop on the next free shape id", () => {
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
  const framed = groupCommands(parts, register, { change: "plain-frame", nodes: ["256.4", "256.5"] as never })
  expect(framed?.[0]).toMatchObject({
    command: "slide",
    edit: {
      slide: "element-group",
      element: { node: "256.6", opening: { layout: { flow: { set: "none" } } } },
      backdrop: { node: "256.7", kind: "shape" },
    },
  })
})

const groupOnTopSlide = `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9000" cy="1000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>Title</a:t></a:r></a:p></p:txBody></p:sp><p:grpSp><p:nvGrpSpPr><p:cNvPr id="5" name="Group 5"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="1000" y="2000"/><a:ext cx="4000" cy="2000"/><a:chOff x="1000" y="2000"/><a:chExt cx="4000" cy="2000"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="3" name="Left"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1000" y="2000"/><a:ext cx="1500" cy="2000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="Right"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="3500" y="2000"/><a:ext cx="1500" cy="2000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp></p:grpSp></p:spTree></p:cSld></p:sld>`

it("adds a layer after ungrouping the slide's top group without reusing the group's id", () => {
  const parts = onSlide(xml(groupOnTopSlide))
  const { slides, elements } = indexPackage(parts)
  const register: Register = {
    ...openRegister("", ""),
    index: { total: elements.length, slides, elements, pages: [{ once: "page", offset: 0, count: elements.length }] },
  }
  const ungroup = groupCommands(parts, register, { change: "ungroup", node: "256.5" as never })
  expect(ungroup?.[0]).toMatchObject({ edit: { slide: "element-ungroup", node: "256.5" } })
  const ungrouped = ran(register, ungroup ?? [])
  const edit = elementCommand(parts, ungrouped, { change: "text", index: 0, size })
  if (edit === null) throw new Error("add")
  expect(edit).toMatchObject({ slide: "element-add", element: { node: "256.6" } })
  expect(decide(ungrouped, { command: "slide", file, edit }).decision).toBe("apply")
})
