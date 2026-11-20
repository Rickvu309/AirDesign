import {
  changeLayout,
  decide,
  elementId,
  openRegister,
  slideId,
  type Command,
  type ElementId,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts, indexPackage, orderedParts, paintReader, readShapes, type PaintBox } from "./index.js"
import { decodeUtf8 } from "./package-bytes.js"

const xml = (value: string) => Uint8Array.from(value, (letter) => letter.charCodeAt(0))
const part = "ppt/slides/slide1.xml"
const slide = slideId("258")
const file = [slide]

const shape = (id: number, x: number, y: number, cx: number, cy: number) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>`
const fileGroup =
  `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
  `<p:grpSpPr><a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="400000" cy="200000"/><a:chOff x="0" y="0"/><a:chExt cx="200000" cy="100000"/></a:xfrm></p:grpSpPr>` +
  `${shape(11, 0, 0, 100000, 100000)}${shape(12, 100000, 0, 100000, 100000)}</p:grpSp>`
const body = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shape(3, 100000, 100000, 200000, 100000)}${shape(4, 50000, 50000, 10000, 10000)}${fileGroup}</p:spTree></p:cSld></p:sld>`

const parts = new Map<string, Uint8Array>([
  [
    "ppt/presentation.xml",
    xml('<p:presentation><p:sldIdLst><p:sldId id="258" r:id="rId1"/></p:sldIdLst></p:presentation>'),
  ],
  [
    "ppt/_rels/presentation.xml.rels",
    xml(
      '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
    ),
  ],
  [part, xml(body)],
])

const { slides, elements } = indexPackage(parts)
const opened: Register = {
  ...openRegister("", ""),
  index: { total: elements.length, slides, elements, pages: [{ once: "page", offset: 0, count: elements.length }] },
}
const node = (id: number) => elementId(`258.${id}`)

function ran(register: Register, commands: readonly Command[]): Register {
  let current = register
  for (const command of commands) {
    const named = command.command === "person" ? command.node : undefined
    if (named !== undefined && !current.nodes.includes(named)) {
      const added = decide(current, { command: "add", node: named, floor: "", route: "" })
      if (added.decision !== "apply") throw new Error(added.code)
      current = added.register
    }
    const decision = decide(current, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    current = decision.register
  }
  return current
}

function joined(register: Register, layer: ElementId, frame: ElementId | null, before: ElementId | null = null) {
  const changed = changeLayout(register, { move: layer, frame, before, file })
  if (changed === null || !("turn" in changed)) throw new Error("join")
  return ran(register, changed.turn)
}

function exported(register: Register) {
  return exportParts(orderedParts(parts, register), register)
}

function painted(shown: ReadonlyMap<string, Uint8Array>, id: number): PaintBox {
  const box = paintReader(shown)
    .slide(part)
    .elements.find((each) => each.shape === String(id))?.box
  if (box === undefined || box === null) throw new Error(`paint ${id}`)
  return box
}

function samePlace(left: PaintBox, right: PaintBox) {
  for (const key of ["x", "y", "width", "height"] as const)
    expect(Math.abs(left[key] - right[key])).toBeLessThanOrEqual(1)
}

function tree(shown: ReadonlyMap<string, Uint8Array>) {
  return readShapes(shown).map((each) => [each.shape, each.group ?? null])
}

describe("a layer moved into or out of a file group exports as that group's child", () => {
  it("writes the joined layer in the group's child space and fits the group around its layers", () => {
    const shown = exported(joined(opened, node(3), node(10)))
    expect(tree(shown)).toEqual([
      ["4", null],
      ["10", null],
      ["11", "10"],
      ["12", "10"],
      ["3", "10"],
    ])
    for (const id of [3, 11, 12]) samePlace(painted(shown, id), painted(parts, id))
    const text = decodeUtf8(shown.get(part) ?? new Uint8Array())
    expect(text).toContain(
      '<a:off x="100000" y="100000"/><a:ext cx="1300000" cy="1100000"/><a:chOff x="-450000" y="-450000"/><a:chExt cx="650000" cy="550000"/>',
    )
    expect(text).toContain(shape(4, 50000, 50000, 10000, 10000))
    expect(text).toContain(shape(11, 0, 0, 100000, 100000))
  })

  it("puts a layer that leaves the group on the slide behind the layer it was dropped under, where it showed", () => {
    const shown = exported(joined(opened, node(11), null, node(4)))
    expect(tree(shown)).toEqual([
      ["3", null],
      ["11", null],
      ["4", null],
      ["10", null],
      ["12", "10"],
    ])
    for (const id of [11, 12]) samePlace(painted(shown, id), painted(parts, id))
    const text = decodeUtf8(shown.get(part) ?? new Uint8Array())
    expect(text).toContain(
      '<a:off x="1200000" y="1000000"/><a:ext cx="200000" cy="200000"/><a:chOff x="100000" y="0"/><a:chExt cx="100000" cy="100000"/>',
    )
    expect(text).toContain(shape(12, 100000, 0, 100000, 100000))
  })
})
