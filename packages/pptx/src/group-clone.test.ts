import {
  cloneOf,
  decide,
  elementId,
  elementsUndoable,
  groupOf,
  nextElementId,
  openRegister,
  shownPlace,
  slideId,
  undoOf,
  type ElementId,
  type Register,
  type SlideCommand,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts, indexPackage, orderedParts, paintReader, readShapes, type PaintBox } from "./index.js"
import { decodeUtf8 } from "./package-bytes.js"
import { shapeIdCounts } from "./shape-id.js"

const xml = (value: string) => Uint8Array.from(value, (letter) => letter.charCodeAt(0))
const part = "ppt/slides/slide1.xml"
const slide = slideId("258")
const file = [slide]

const shape = (id: number, x: number, y: number, cx: number, cy: number) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>`
const group = (id: number, turn: string, place: string, children: string) =>
  `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="g${id}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm${turn}>${place}</a:xfrm></p:grpSpPr>${children}</p:grpSp>`
const inner = group(
  11,
  ' rot="5400000" flipH="1"',
  '<a:off x="100000" y="50000"/><a:ext cx="200000" cy="100000"/><a:chOff x="0" y="0"/><a:chExt cx="100000" cy="50000"/>',
  shape(12, 0, 0, 50000, 50000) + shape(13, 50000, 0, 50000, 50000),
)
const outer = group(
  10,
  "",
  '<a:off x="1000000" y="1000000"/><a:ext cx="800000" cy="400000"/><a:chOff x="0" y="0"/><a:chExt cx="400000" cy="200000"/>',
  inner + shape(14, 300000, 100000, 100000, 100000),
)
const body = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shape(3, 0, 0, 100000, 100000)}${shape(4, 3000000, 0, 100000, 100000)}${outer}</p:spTree></p:cSld></p:sld>`

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

const node = (id: number) => elementId(`258.${id}`)
const { slides, elements: read } = indexPackage(parts)
const turned = { "box.rot": [90], "box.flipH": [true] } as const
const elements = read.map((element) => (element.node === node(11) ? { ...element, design: turned } : element))
const opened: Register = {
  ...openRegister("", ""),
  index: { format: 2, total: elements.length, slides, elements, pages: [] },
}

function applied(register: Register, edit: SlideCommand): Register {
  const decision = decide(register, { command: "slide", file, edit })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function copied(register: Register, source: ElementId, dx: number, dy: number) {
  const shown = shownPlace(register, source)?.box
  if (shown === undefined) throw new Error("shown")
  const made = cloneOf(register, source, nextElementId(register, slide, 20), {
    ...shown,
    x: shown.x + dx,
    y: shown.y + dy,
  })
  if (!made.ok) throw new Error(made.refusal)
  return { command: made.command, after: applied(register, made.command) }
}

const exported = (register: Register) => exportParts(orderedParts(parts, register), register)

function painted(shown: ReadonlyMap<string, Uint8Array>, id: number): PaintBox {
  const box = paintReader(shown)
    .slide(part)
    .elements.find((each) => each.shape === String(id))?.box
  if (box === undefined || box === null) throw new Error(`paint ${id}`)
  return box
}

function near(left: PaintBox, right: PaintBox, dx = 0, dy = 0) {
  expect(left.rotation).toBeCloseTo(right.rotation, 6)
  expect([left.flipH, left.flipV]).toEqual([right.flipH, right.flipV])
  const wanted = { ...right, x: right.x + dx, y: right.y + dy }
  for (const side of ["x", "y", "width", "height"] as const) expect(Math.abs(left[side] - wanted[side])).toBeLessThan(3)
}

function spanOf(text: string, id: number): string {
  const start = text.indexOf(`<p:sp><p:nvSpPr><p:cNvPr id="${id}"`)
  return text.slice(start, text.indexOf("</p:sp>", start) + "</p:sp>".length)
}

const copyOf = (command: SlideCommand, source: number) => {
  if (command.slide !== "element-clone") throw new Error("clone")
  const layer = command.layers?.find((each) => each.source === node(source))
  return Number((layer?.element.node ?? "").split(".")[1])
}

const tree = (shown: ReadonlyMap<string, Uint8Array>) =>
  readShapes(shown).map((each) => [each.shape, each.group ?? null])

describe("a copy of a group or of a layer inside one exports as PowerPoint holds it", () => {
  it("copies a group with its nested, turned group under new ids, offset, and leaves the source's bytes", () => {
    const { command, after } = copied(opened, node(10), 0, 2_000_000)
    const shown = exported(after)
    const text = decodeUtf8(shown.get(part) ?? new Uint8Array())
    expect(shapeIdCounts(shown).filter((row) => row.count > 1)).toEqual([])
    expect(shapeIdCounts(shown).length).toBe(shapeIdCounts(parts).length + 5)
    const top = Number(command.slide === "element-clone" ? command.element.node.split(".")[1] : "")
    expect(tree(shown).filter(([id]) => Number(id) >= 20)).toEqual([
      [String(top), null],
      [String(copyOf(command, 11)), String(top)],
      [String(copyOf(command, 12)), String(copyOf(command, 11))],
      [String(copyOf(command, 13)), String(copyOf(command, 11))],
      [String(copyOf(command, 14)), String(top)],
    ])
    for (const id of [11, 12, 13, 14]) near(painted(shown, copyOf(command, id)), painted(parts, id), 0, 2_000_000)
    for (const id of [3, 12, 13, 14]) expect(spanOf(text, id)).toBe(spanOf(body, id))
  })

  it("copies a layer inside a turned group just above it in that group, where it was dropped", () => {
    const { command, after } = copied(opened, node(12), 300_000, 0)
    const shown = exported(after)
    const copy = Number(command.slide === "element-clone" ? command.element.node.split(".")[1] : "")
    const ids = tree(shown).map(([id]) => id)
    expect(tree(shown).find(([id]) => id === String(copy))).toEqual([String(copy), "11"])
    expect(ids.indexOf(String(copy))).toBe(ids.indexOf("12") + 1)
    near(painted(shown, copy), painted(parts, 12), 300_000, 0)
    for (const id of [12, 13, 14, 3]) near(painted(shown, id), painted(parts, id))
  })

  it("copies a group the person made in AirDesign, after its layers were wrapped", () => {
    const made = groupOf(opened, slide, node(30), [node(3), node(4)])
    if (made === null) throw new Error("group")
    const grouped = applied(opened, made)
    const { command, after } = copied(grouped, node(30), 0, 500_000)
    const shown = exported(after)
    const top = Number(command.slide === "element-clone" ? command.element.node.split(".")[1] : "")
    expect(tree(shown).filter(([, parent]) => parent === String(top)).length).toBe(2)
    for (const id of [3, 4]) near(painted(shown, copyOf(command, id)), painted(parts, id), 0, 500_000)
  })

  it("writes back the file's very bytes once the copy is undone", () => {
    const { command, after } = copied(opened, node(10), 0, 2_000_000)
    const undoable = elementsUndoable(opened, file, [command as Extract<SlideCommand, { slide: "element-clone" }>])
    if (undoable === null) throw new Error("undoable")
    const back = undoOf(after, undoable)
    if (!back.ok) throw new Error("undo")
    const undone = back.commands.reduce((register, each) => {
      const decision = decide(register, each)
      if (decision.decision !== "apply") throw new Error(decision.code)
      return decision.register
    }, after)
    expect(decodeUtf8(exported(undone).get(part) ?? new Uint8Array())).toBe(body)
  })
})
