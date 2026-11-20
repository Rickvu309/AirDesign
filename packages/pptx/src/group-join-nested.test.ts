import {
  changeLayout,
  decide,
  elementId,
  openRegister,
  slideId,
  spotNow,
  undoOf,
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
const body = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shape(3, 0, 0, 100000, 100000)}${outer}</p:spTree></p:cSld></p:sld>`

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

function dragged(register: Register, layer: ElementId, frame: ElementId | null) {
  const was = spotNow(register, layer)
  const changed = changeLayout(register, { move: layer, frame, before: null, file })
  if (was === null || changed === null || !("turn" in changed)) throw new Error("join")
  const after = ran(register, changed.turn)
  const back = undoOf(after, { joined: layer, slide, file, before: was, after: { ...was, frame, before: null } })
  if (!back.ok) throw new Error("undo")
  return { after, undone: ran(after, back.commands) }
}

const exported = (register: Register) => exportParts(orderedParts(parts, register), register)

function painted(shown: ReadonlyMap<string, Uint8Array>, id: number): PaintBox {
  const box = paintReader(shown)
    .slide(part)
    .elements.find((each) => each.shape === String(id))?.box
  if (box === undefined || box === null) throw new Error(`paint ${id}`)
  return box
}

function near(left: PaintBox, right: PaintBox) {
  expect(left.rotation).toBeCloseTo(right.rotation, 6)
  expect([left.flipH, left.flipV]).toEqual([right.flipH, right.flipV])
  for (const side of ["x", "y", "width", "height"] as const) expect(Math.abs(left[side] - right[side])).toBeLessThan(3)
}

function spanOf(text: string, id: number): string {
  const start = text.indexOf(`<p:sp><p:nvSpPr><p:cNvPr id="${id}"`)
  return text.slice(start, text.indexOf("</p:sp>", start) + "</p:sp>".length)
}

function bounds(boxes: readonly PaintBox[]): Pick<PaintBox, "x" | "y" | "width" | "height"> {
  const corners = boxes.flatMap((box) => {
    const radians = (box.rotation * Math.PI) / 180
    const halfX = (Math.abs(box.width * Math.cos(radians)) + Math.abs(box.height * Math.sin(radians))) / 2
    const halfY = (Math.abs(box.width * Math.sin(radians)) + Math.abs(box.height * Math.cos(radians))) / 2
    const [middleX, middleY] = [box.x + box.width / 2, box.y + box.height / 2]
    return [
      [middleX - halfX, middleY - halfY],
      [middleX + halfX, middleY + halfY],
    ] as const
  })
  const left = Math.min(...corners.map(([x]) => x))
  const top = Math.min(...corners.map(([, y]) => y))
  return {
    x: left,
    y: top,
    width: Math.max(...corners.map(([x]) => x)) - left,
    height: Math.max(...corners.map(([, y]) => y)) - top,
  }
}

function fits(shown: ReadonlyMap<string, Uint8Array>, id: number, children: readonly number[]) {
  const own = painted(shown, id)
  const fitted = bounds(children.map((child) => painted(shown, child)))
  for (const side of ["x", "y", "width", "height"] as const) expect(Math.abs(own[side] - fitted[side])).toBeLessThan(3)
}

const tree = (shown: ReadonlyMap<string, Uint8Array>) =>
  readShapes(shown).map((each) => [each.shape, each.group ?? null])

describe("a layer dragged into or out of nested, turned and flipped file groups", () => {
  it("joins a turned, flipped group inside a scaled one where it shows, and both groups fit their layers", () => {
    const { after } = dragged(opened, node(3), node(11))
    const shown = exported(after)
    const text = decodeUtf8(shown.get(part) ?? new Uint8Array())
    expect(tree(shown)).toEqual([
      ["10", null],
      ["11", "10"],
      ["12", "11"],
      ["13", "11"],
      ["3", "11"],
      ["14", "10"],
    ])
    for (const id of [3, 12, 13, 14]) near(painted(shown, id), painted(parts, id))
    for (const id of [12, 13, 14]) expect(spanOf(text, id)).toBe(spanOf(body, id))
    fits(shown, 10, [3, 12, 13, 14])
    expect(text).toMatch(/<p:cNvPr id="11" name="g11"\/>.*?<a:xfrm rot="5400000" flipH="1">/)
  })

  it("paints the joined layer in place when the slide base replays without the index, as the editor's canvas does", () => {
    const { after } = dragged(opened, node(3), node(11))
    const { index: _index, ...bare } = after
    const shown = exportParts(orderedParts(parts, bare), after)
    for (const id of [3, 12, 13, 14]) near(painted(shown, id), painted(parts, id))
  })

  it("leaves a turned group two levels down for the slide where it shows, and Undo puts it back", () => {
    const { after, undone } = dragged(opened, node(12), null)
    const shown = exported(after)
    expect(tree(shown).find(([id]) => id === "12")).toEqual(["12", null])
    for (const id of [12, 13, 14]) near(painted(shown, id), painted(parts, id))
    fits(shown, 10, [13, 14])
    const back = exported(undone)
    expect(tree(back)).toEqual(tree(parts))
    for (const id of [3, 12, 13, 14]) near(painted(back, id), painted(parts, id))
  })

  it("drops the emptied group from the file, and Undo puts the group and its layer back", () => {
    const one = dragged(opened, node(12), null).after
    const { after, undone } = dragged(one, node(13), null)
    const shown = exported(after)
    const text = decodeUtf8(shown.get(part) ?? new Uint8Array())
    expect(text).not.toContain('<p:cNvPr id="11"')
    expect(tree(shown).filter(([, parent]) => parent === "10")).toEqual([["14", "10"]])
    for (const id of [12, 13, 14]) near(painted(shown, id), painted(parts, id))
    fits(shown, 10, [14])
    const back = exported(undone)
    expect(tree(back).filter(([id]) => id === "11" || id === "13")).toEqual([
      ["11", "10"],
      ["13", "11"],
    ])
    near(painted(back, 13), painted(parts, 13))
  })
})
