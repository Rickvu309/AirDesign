import {
  beforeOf,
  decide,
  elementId,
  format,
  landedPatch,
  openRegister,
  planChange,
  registerScope,
  shownPlace,
  type ElementPatch,
  type Register,
  type SetChange,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts, indexPackage, paintReader, type PaintBox } from "./index.js"
import { decodeUtf8 } from "./package-bytes.js"

const xml = (value: string) => Uint8Array.from(value, (letter) => letter.charCodeAt(0))
const part = "ppt/slides/slide1.xml"

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

function landed(register: Register, at: typeof node extends (id: number) => infer N ? N : never, patch: ElementPatch) {
  let current = register
  if (!current.nodes.includes(at)) {
    const added = decide(current, { command: "add", node: at, floor: "", route: "" })
    if (added.decision !== "apply") throw new Error(added.code)
    current = added.register
  }
  const decision = decide(current, { command: "person", node: at, v: format, patch })
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function planned(register: Register, change: SetChange): Register {
  const plan = planChange(change, registerScope(register))
  if (!plan.ok) throw new Error(JSON.stringify(plan.refusals))
  return plan.rows.reduce((current, row) => landed(current, row.node, row.row.patch), register)
}

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
  for (const side of ["x", "y", "width", "height"] as const) expect(Math.abs(left[side] - right[side])).toBeLessThan(2)
}

function spanOf(text: string, id: number): string {
  const start = text.indexOf(`<p:sp><p:nvSpPr><p:cNvPr id="${id}"`)
  return text.slice(start, text.indexOf("</p:sp>", start) + "</p:sp>".length)
}

const xfrmOf = (text: string, id: number) => {
  const start = text.indexOf(`<p:cNvPr id="${id}"`)
  return text.slice(text.indexOf("<a:xfrm", start), text.indexOf("</a:xfrm>", start) + "</a:xfrm>".length)
}

describe("a layer moved inside nested groups", () => {
  const before = exportParts(parts, opened)
  const shown = shownPlace(opened, node(12))
  const moved = planned(opened, { target: { node: node(12) }, box: { x: (shown?.box.x ?? 0) + 600_000 } })
  const after = exportParts(parts, moved)
  const text = decodeUtf8(after.get(part) ?? new Uint8Array())

  it("lands where the person put it on the slide, through a scaled group and a turned, flipped one", () => {
    const wanted = shownPlace(moved, node(12))
    expect(wanted?.box.x).toBe((shown?.box.x ?? 0) + 600_000)
    const leaf = painted(after, 12)
    expect(Math.abs(leaf.x - (wanted?.box.x ?? 0))).toBeLessThan(2)
    expect(Math.abs(leaf.y - (shown?.box.y ?? 0))).toBeLessThan(2)
    expect(leaf.rotation).toBeCloseTo(painted(before, 12).rotation, 6)
  })

  it("keeps every other layer where it was and keeps its bytes", () => {
    for (const id of [3, 13, 14]) near(painted(after, id), painted(before, id))
    for (const id of [3, 13, 14]) expect(spanOf(text, id)).toBe(spanOf(body, id))
  })

  it("fits each group's child space to its layers and keeps its turn", () => {
    const sides = (id: number) => (xfrmOf(text, id).match(/-?\d+/g) ?? []).map(Number)
    const [leafX = 0, leafY = 0, leafW = 0, leafH = 0] = sides(12)
    const left = Math.min(leafX, 50000)
    const right = Math.max(leafX + leafW, 100000)
    const bottom = Math.max(leafY + leafH, 50000)
    const top = Math.min(leafY, 0)
    expect(xfrmOf(text, 11)).toContain(
      `<a:chOff x="${left}" y="${top}"/><a:chExt cx="${right - left}" cy="${bottom - top}"/>`,
    )
    expect(xfrmOf(text, 11)).toMatch(/^<a:xfrm rot="5400000" flipH="1">/)
    expect(xfrmOf(text, 10)).not.toBe(xfrmOf(body, 10))
    near(painted(after, 10), {
      ...painted(after, 10),
      ...shownBox(moved, 10),
    })
  })

  it("writes back the very bytes of the file when the move is undone", () => {
    const body12 = moved.elements[node(12)]
    if (body12 === undefined) throw new Error("body")
    const patch = landedPatch(body12, "text")
    const undone = landed(moved, node(12), beforeOf({}, patch))
    expect(decodeUtf8(exportParts(parts, undone).get(part) ?? new Uint8Array())).toBe(body)
  })
})

function shownBox(register: Register, id: number): Partial<PaintBox> {
  const place = shownPlace(register, node(id))
  if (place === null) return {}
  return { x: place.box.x, y: place.box.y, width: place.box.cx, height: place.box.cy }
}
