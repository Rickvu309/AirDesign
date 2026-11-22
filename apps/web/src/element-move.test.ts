import { decide, elementId, format, openRegister, type Command, type Register } from "@airdesign/document"
import { markupBytesRead, readShapes } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { boxStorable, landedBox, paintedBox } from "./element-move"
import { onSlide, xml } from "./slide-fixtures"

const namespaces =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"'
const xfrm = '<a:xfrm><a:off x="10" y="20"/><a:ext cx="30" cy="40"/></a:xfrm>'

function slide(shapes: string): Map<string, Uint8Array> {
  return onSlide(xml(`<p:sld ${namespaces}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`))
}

function storable(shapes: string, id: string): boolean {
  const parts = slide(shapes)
  const shape = readShapes(parts).find((each) => each.shape === id)
  if (shape === undefined) throw new Error(`no shape ${id}`)
  return boxStorable(parts, shape)
}

const sp = (id: string, properties = `<p:spPr>${xfrm}</p:spPr>`) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>${properties}<p:txBody><a:bodyPr/><a:p><a:r><a:t>Hi</a:t></a:r></a:p></p:txBody></p:sp>`

it.each([
  ["a shape with its own box", sp("2")],
  ["a placeholder that takes its box from the layout", sp("2", "<p:spPr/>")],
  ["an empty transform", sp("2", "<p:spPr><a:xfrm/></p:spPr>")],
  ["a transform with only an offset", sp("2", '<p:spPr><a:xfrm><a:off x="10" y="20"/></a:xfrm></p:spPr>')],
  ["a transform with only an extent", sp("2", '<p:spPr><a:xfrm><a:ext cx="30" cy="40"/></a:xfrm></p:spPr>')],
  [
    "a picture",
    `<p:pic><p:nvPicPr><p:cNvPr id="2" name="p"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill/><p:spPr>${xfrm}</p:spPr></p:pic>`,
  ],
  [
    "a connector",
    `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="2" name="c"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>${xfrm}</p:spPr></p:cxnSp>`,
  ],
  [
    "a group on the slide, whose box carries its children",
    `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="2" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr>${xfrm}</p:grpSpPr>${sp("3")}</p:grpSp>`,
  ],
])("lets %s keep a box", (_name, shapes) => {
  expect(storable(shapes, "2")).toBe(true)
})

it.each([
  [
    "a chart frame, whose size PowerPoint does not take from the frame alone",
    `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2" name="g"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></p:xfrm><a:graphic/></p:graphicFrame>`,
  ],
  [
    "a shape inside a group, whose box sits in the group's own space",
    `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="3" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr>${xfrm}</p:grpSpPr>${sp("2")}</p:grpSp>`,
  ],
  ["a shape the move route cannot write", sp("2", "")],
  [
    "a shape locked by its fallback twin",
    `<mc:AlternateContent><mc:Choice Requires="x">${sp("2")}</mc:Choice><mc:Fallback>${sp("2")}</mc:Fallback></mc:AlternateContent>`,
  ],
])("does not let %s keep a box", (_name, shapes) => {
  expect(storable(shapes, "2")).toBe(false)
})

it("probes every box on the original slide within one XML parse", () => {
  const parts = slide(Array.from({ length: 20 }, (_, index) => sp(String(index + 2))).join(""))
  const shapes = readShapes(parts)
  const fresh = new Map([...parts].map(([name, bytes]) => [name, bytes.slice()]))
  const before = markupBytesRead()
  expect(shapes.map((shape) => boxStorable(fresh, shape))).toEqual(shapes.map(() => true))
  const bytes = fresh.get("ppt/slides/slide1.xml")
  if (bytes === undefined) throw new Error("missing slide")
  expect(markupBytesRead() - before).toBeLessThanOrEqual(bytes.length)
  expect(fresh).toEqual(parts)
})

const node = elementId("256.2")
const box = { x: 1, y: 2, cx: 3, cy: 4 }

function landed(commands: readonly Command[]): Register {
  let register = openRegister("", "deck")
  for (const command of commands) {
    const decision = decide(register, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    register = decision.register
  }
  return register
}

it("answers the last landed box, and none for an element with no box row or no register", () => {
  const added = { command: "add", node, floor: "", route: "deck" } as const
  const moved = { command: "person", node, property: "box", value: box } as const
  const typed = { command: "person", node, value: "Typed" } as const
  expect(landedBox(landed([added, moved, typed]), node)).toEqual(box)
  expect(landedBox(landed([added, typed]), node)).toBeNull()
  expect(landedBox(landed([]), node)).toBeNull()
  expect(landedBox(null, node)).toBeNull()
})

it("answers a box an agent's run landed, so the device paints it like a person's", () => {
  const added = { command: "add", node, floor: "", route: "deck" } as const
  const started = { command: "start", node, runId: "run" } as const
  const moved = { command: "agent", node, runId: "run", readAt: 0, property: "box", value: box } as const
  expect(landedBox(landed([added, started, moved]), node)).toEqual(box)
})

it("answers a box an agent's set row landed, with no index on the device", () => {
  const added = { command: "add", node, floor: "", route: "deck" } as const
  const started = { command: "start", node, runId: "run" } as const
  const sides = { x: { set: box.x }, y: { set: box.y }, w: { set: box.cx }, h: { set: box.cy } }
  const set = { command: "agent", node, runId: "run", readAt: 0, v: format, patch: { box: sides } } as const
  const typed = {
    command: "agent",
    node,
    runId: "run",
    readAt: 0,
    v: format,
    patch: { text: { value: { set: "x" } } },
  } as const
  expect(landedBox(landed([added, started, set]), node)).toEqual(box)
  expect(landedBox(landed([added, started, typed]), node)).toBeNull()
})

it("takes the box a person saw from the painted slide, so a picture or a placeholder with a layout box can be undone", () => {
  const upright = { rotation: 0, flipH: false, flipV: false }
  const painted = {
    width: 100,
    height: 100,
    background: null,
    elements: [{ id: elementId("256.4"), box: { x: 10.4, y: 20, width: 30, height: 39.6, ...upright } }],
  }
  expect(paintedBox(painted, elementId("256.4"))).toEqual({ x: 10, y: 20, cx: 30, cy: 40 })
  expect(paintedBox(painted, elementId("256.5"))).toBeNull()
  expect(paintedBox(null, elementId("256.4"))).toBeNull()
})
