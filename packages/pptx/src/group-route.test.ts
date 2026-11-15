import {
  decide,
  elementId,
  groupOf,
  openRegister,
  slideId,
  ungroupTurn,
  type Command,
  type Register,
  type SlideCommand,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts, indexPackage, orderedParts, paintReader, readShapes, type PaintBox } from "./index.js"
import { decodeUtf8 } from "./package-bytes.js"

const xml = (value: string) => Uint8Array.from(value, (letter) => letter.charCodeAt(0))
const part = "ppt/slides/slide1.xml"
const slide = slideId("258")
const file = [slide]

const shape = (id: number, x: number, y: number, cx: number, cy: number, fill = "") =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}</p:spPr></p:sp>`
const fileGroup =
  `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
  `<p:grpSpPr><a:xfrm rot="5400000" flipH="1"><a:off x="1000000" y="1000000"/><a:ext cx="400000" cy="200000"/><a:chOff x="0" y="0"/><a:chExt cx="200000" cy="100000"/></a:xfrm><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:grpSpPr>` +
  `${shape(11, 0, 0, 100000, 100000)}${shape(12, 100000, 0, 100000, 100000, "<a:grpFill/>")}<p:extLst/></p:grpSp>`
const body = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shape(3, 100000, 100000, 200000, 100000)}${shape(4, 50000, 50000, 10000, 10000)}${shape(5, 400000, 300000, 100000, 100000)}${fileGroup}</p:spTree></p:cSld></p:sld>`

function packaged() {
  return new Map<string, Uint8Array>([
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
}

const parts = packaged()
const { slides, elements: read } = indexPackage(parts)
const turned = { "box.rot": [90], "box.flipH": [true] } as const
const elements = read.map((element) => (element.node === "258.10" ? { ...element, design: turned } : element))
const opened: Register = {
  ...openRegister("", ""),
  index: { total: elements.length, slides, elements, pages: [{ once: "page", offset: 0, count: elements.length }] },
}
const node = (shape: number) => elementId(`258.${shape}`)

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

const slideCommand = (edit: SlideCommand): Command => ({ command: "slide", file, edit })

function grouped(register: Register): Register {
  const command = groupOf(register, slide, node(20), [node(3), node(5)])
  if (command === null) throw new Error("group")
  return ran(register, [slideCommand(command)])
}

function exported(register: Register) {
  return exportParts(orderedParts(parts, register), register)
}

function painted(shown: ReadonlyMap<string, Uint8Array>, shape: number): PaintBox {
  const box = paintReader(shown)
    .slide(part)
    .elements.find((each) => each.shape === String(shape))?.box
  if (box === undefined || box === null) throw new Error(`paint ${shape}`)
  return box
}

function samePlace(left: PaintBox, right: PaintBox) {
  for (const key of ["x", "y", "width", "height"] as const)
    expect(Math.abs(left[key] - right[key])).toBeLessThanOrEqual(1)
  expect(((left.rotation - right.rotation + 540) % 360) - 180).toBeCloseTo(0, 3)
  expect([left.flipH, left.flipV]).toEqual([right.flipH, right.flipV])
}

const moved = (register: Register, x: number) =>
  ran(register, [{ command: "person", v: 13, patch: { box: { x: { set: x } } }, node: node(20) }])

describe("group export", () => {
  it("indexes a group's child frame and each child's group", () => {
    const tree = read.filter((element) => element.kind === "group" || element.grouped)
    expect(tree.map(({ node, frame, group }) => ({ node, frame, group }))).toEqual([
      { node: "258.10", frame: { x: 0, y: 0, cx: 200000, cy: 100000 }, group: undefined },
      { node: "258.11", frame: undefined, group: "258.10" },
      { node: "258.12", frame: undefined, group: "258.10" },
    ])
  })

  it("wraps two shapes in a group whose child frame is its own box, so neither moves", () => {
    const shown = exported(grouped(opened))
    for (const shape of [3, 5]) samePlace(painted(shown, shape), painted(parts, shape))
    const text = decodeUtf8(shown.get(part) ?? new Uint8Array())
    expect(text).toContain(
      '<a:off x="100000" y="100000"/><a:ext cx="400000" cy="300000"/><a:chOff x="100000" y="100000"/><a:chExt cx="400000" cy="300000"/>',
    )
    const read = readShapes(shown).filter((each) => each.shape === "3" || each.shape === "4" || each.shape === "5")
    expect(read.map((each) => [each.shape, each.group ?? null])).toEqual([
      ["4", null],
      ["3", "20"],
      ["5", "20"],
    ])
  })

  it("moves a made group with its shapes and ungroups it with nothing moving", () => {
    const shifted = moved(grouped(opened), 600000)
    const before = exported(shifted)
    expect(painted(before, 3).x).toBe(600000)
    const turn = ungroupTurn(shifted, file, slide, node(20))
    if (turn === null) throw new Error("ungroup")
    const after = exported(ran(shifted, turn))
    for (const shape of [3, 5]) samePlace(painted(after, shape), painted(before, shape))
    expect(decodeUtf8(after.get(part) ?? new Uint8Array())).not.toContain('id="20"')
  })

  it("ungroups a turned, flipped group with nothing moving and gives its fill to the child that took it", () => {
    const turn = ungroupTurn(opened, file, slide, node(10))
    if (turn === null) throw new Error("ungroup")
    const after = exported(ran(opened, turn))
    for (const shape of [11, 12]) samePlace(painted(after, shape), painted(parts, shape))
    const text = decodeUtf8(after.get(part) ?? new Uint8Array())
    expect(text).not.toContain("<p:grpSp>")
    expect(text).not.toContain("<a:grpFill/>")
    expect(text).toContain('<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:spPr>')
    expect(text).not.toContain("<p:extLst/>")
  })

  it("puts an ungrouped file group back byte for byte when the ungroup is undone", () => {
    const turn = ungroupTurn(opened, file, slide, node(10))
    if (turn === null) throw new Error("ungroup")
    const back = ran(ran(opened, turn), [slideCommand({ slide: "element-regroup", id: slide, node: node(10) })])
    expect(decodeUtf8(exported(back).get(part) ?? new Uint8Array())).toBe(body)
  })

  it("orders the slide before grouping, so the group sits where the person saw its front member", () => {
    const among = [node(3), node(4), node(5), node(10)]
    const ordered = ran(opened, [
      slideCommand({ slide: "element-order", id: slide, node: node(3), before: node(10), among }),
    ])
    const shown = exported(grouped(ordered))
    const ids = readShapes(shown)
      .filter((each) => each.group === undefined)
      .map((each) => each.shape)
    expect(ids).toEqual(["4", "20", "10"])
  })
})
