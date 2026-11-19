import {
  changeLayout,
  decide,
  elementId,
  slideUndoable,
  undoOf,
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
    [
      "[Content_Types].xml",
      xml(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
      ),
    ],
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

function wrapCommand(register: Register, shapes: readonly number[] = [3, 5]): SlideCommand {
  const changed = changeLayout(register, { wrap: shapes.map(node), slide, node: node(20), backdrop: node(21) })
  if (changed === null || !("slide" in changed)) throw new Error("wrap")
  return changed.slide
}

function wrapped(register: Register): Register {
  return ran(register, [slideCommand(wrapCommand(register))])
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

const gapped = (register: Register, gap: number) =>
  ran(register, [{ command: "person", v: 13, patch: { layout: { gap: { set: gap } } }, node: node(20) }])

describe("auto layout frame export", () => {
  it("writes the frame as a group with a blank backdrop first and its children laid out in a row", () => {
    const shown = exported(wrapped(opened))
    expect(painted(shown, 3)).toMatchObject({ x: 100000, y: 100000, width: 200000, height: 100000 })
    expect(painted(shown, 5)).toMatchObject({ x: 401600, y: 100000, width: 100000, height: 100000 })
    expect(painted(shown, 21)).toMatchObject({ x: 100000, y: 100000, width: 401600, height: 100000 })
    const text = decodeUtf8(shown.get(part) ?? new Uint8Array())
    expect(text).toContain(
      '<p:cNvPr id="20" name="Frame 20"/><p:cNvGrpSpPr/><p:nvPr><p:custDataLst><p:tags xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></p:custDataLst></p:nvPr></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="100000" y="100000"/><a:ext cx="401600" cy="100000"/><a:chOff x="100000" y="100000"/><a:chExt cx="401600" cy="100000"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="21" name="Backdrop 21"/>',
    )
    expect(text).toContain("<a:noFill/><a:ln><a:noFill/></a:ln>")
    const read = readShapes(shown).filter((each) => ["3", "5", "21"].includes(each.shape))
    expect(read.map((each) => [each.shape, each.group ?? null])).toEqual([
      ["21", "20"],
      ["3", "20"],
      ["5", "20"],
    ])
  })

  it("moves the later child and widens the frame when the gap changes", () => {
    const shown = exported(gapped(wrapped(opened), 50000))
    expect(painted(shown, 5).x).toBe(350000)
    expect(painted(shown, 21).width).toBe(350000)
  })

  it("ungroups with every child where the layout put it and the backdrop gone", () => {
    const before = gapped(wrapped(opened), 50000)
    const turn = ungroupTurn(before, file, slide, node(20))
    if (turn === null) throw new Error("ungroup")
    const after = exported(ran(before, turn))
    expect(painted(after, 5).x).toBe(350000)
    const text = decodeUtf8(after.get(part) ?? new Uint8Array())
    expect(text).not.toContain('<p:grpSp><p:nvGrpSpPr><p:cNvPr id="20"')
    expect(text).not.toContain('id="21"')
  })

  it("gives back the file's slide byte for byte when the wrap is undone", () => {
    const command = wrapCommand(opened, [4, 5])
    const undoable = slideUndoable(opened, file, command)
    if (undoable === null) throw new Error("undoable")
    const after = ran(opened, [slideCommand(command)])
    const undone = undoOf(after, undoable)
    if (!undone.ok) throw new Error("undo")
    expect(decodeUtf8(exported(ran(after, undone.commands)).get(part) ?? new Uint8Array())).toBe(body)
  })
})

describe("auto layout frame members export", () => {
  it("moves a joined shape into the frame's group at its flow place, and a leaving one out after the group", () => {
    const framed = wrapped(opened)
    const join = changeLayout(framed, { place: node(4), box: { x: 250000, y: 100000, cx: 10000, cy: 10000 }, file })
    if (join === null || !("turn" in join)) throw new Error("join")
    const joined = ran(framed, join.turn)
    const text = decodeUtf8(exported(joined).get(part) ?? new Uint8Array())
    const at = (shape: number) => text.indexOf(`<p:cNvPr id="${shape}"`)
    expect(
      [at(21), at(3), at(4), at(5)].every((value, index, all) => index === 0 || value > (all[index - 1] ?? 0)),
    ).toBe(true)
    expect(text.indexOf("</p:grpSp>")).toBeGreaterThan(at(5))
    expect(painted(exported(joined), 4).x).toBe(401600)
    const leave = changeLayout(joined, {
      place: node(3),
      box: { x: 3000000, y: 3000000, cx: 200000, cy: 100000 },
      file,
    })
    if (leave === null || !("turn" in leave)) throw new Error("leave")
    const left = exported(ran(joined, leave.turn))
    const after = decodeUtf8(left.get(part) ?? new Uint8Array())
    expect(after.indexOf('<p:cNvPr id="3"')).toBeGreaterThan(after.indexOf("</p:grpSp>"))
    expect(painted(left, 3)).toMatchObject({ x: 3000000, y: 3000000 })
    expect(painted(left, 4).x).toBe(100000)
  })

  it("lays the frame out without a deleted child", () => {
    const framed = wrapped(opened)
    const removed = ran(framed, [slideCommand({ slide: "element-remove", id: slide, node: node(3) })])
    const shown = exported(removed)
    expect(decodeUtf8(shown.get(part) ?? new Uint8Array())).not.toContain('<p:cNvPr id="3"')
    expect(painted(shown, 5).x).toBe(100000)
  })
})

describe("auto layout frame of added shapes", () => {
  it("keeps the frame when one of its added shapes is deleted", () => {
    const added = [30, 31].map((shape, at) => ({
      node: node(shape),
      kind: "shape" as const,
      value: "",
      box: { x: 1_000_000 + at * 600_000, y: 1_000_000, cx: 400_000, cy: 300_000 },
      grouped: false,
    }))
    const made = ran(
      opened,
      added.map((element) => slideCommand({ slide: "element-add", id: slide, element })),
    )
    const changed = changeLayout(made, { wrap: [node(30), node(31)], slide, node: node(32), backdrop: node(33) })
    if (changed === null || !("slide" in changed)) throw new Error("wrap")
    const framed = ran(made, [slideCommand(changed.slide)])
    const removed = ran(framed, [slideCommand({ slide: "element-remove", id: slide, node: node(31) })])
    const text = decodeUtf8(exported(removed).get(part) ?? new Uint8Array())
    expect(text).toContain('<p:cNvPr id="32" name="Frame 32"/>')
    expect(text).toContain('<p:cNvPr id="30"')
    expect(text).not.toContain('<p:cNvPr id="31"')
  })
})

describe("auto layout frame in PowerPoint", () => {
  const exportedFrame = () => exported(gapped(wrapped(opened), 50000))
  const reread = (shown: ReadonlyMap<string, Uint8Array>) =>
    indexPackage(shown).elements.find((element) => element.node === node(20))
  const edited = (shown: ReadonlyMap<string, Uint8Array>, change: (text: string) => string) =>
    new Map([
      ...shown,
      [
        part,
        Uint8Array.from(change(decodeUtf8(shown.get(part) ?? new Uint8Array())), (letter) => letter.charCodeAt(0)),
      ],
    ])

  it("writes a tag that reads back as the same auto layout frame, with its fields, backdrop and flow", () => {
    const shown = exportedFrame()
    expect([...shown.keys()].filter((name) => name.startsWith("ppt/tags/"))).toEqual(["ppt/tags/tag1.xml"])
    expect(decodeUtf8(shown.get("[Content_Types].xml") ?? new Uint8Array())).toContain('PartName="/ppt/tags/tag1.xml"')
    expect(decodeUtf8(shown.get(part) ?? new Uint8Array())).toContain("<p:custDataLst><p:tags")
    expect(reread(shown)?.framing).toEqual({
      backdrop: node(21),
      children: [node(3), node(5)],
      layout: { flow: "horizontal", gap: 50000, padding: [0, 0, 0, 0], align: "topLeft" },
    })
    expect(
      exportParts(shown, { ...openRegister("", ""), index: { ...indexPackage(shown), total: 0, pages: [] } }),
    ).toBe(shown)
  })

  it("reads a frame whose child moved in PowerPoint as a frame without auto layout, a lost backdrop as a group", () => {
    const shown = exportedFrame()
    const moved = edited(shown, (text) =>
      text.replace('<a:off x="350000" y="100000"/>', '<a:off x="350000" y="900000"/>'),
    )
    expect(reread(moved)?.framing).toMatchObject({ children: [node(3), node(5)], layout: { flow: "none", gap: 50000 } })
    const lost = edited(shown, (text) => text.replace(/<p:sp><p:nvSpPr><p:cNvPr id="21"[\s\S]*?<\/p:sp>/, ""))
    expect(reread(lost)?.framing).toBeUndefined()
    const scaled = edited(shown, (text) =>
      text.replace(/<a:chExt cx="(\d+)"/, (_, cx) => `<a:chExt cx="${Number(cx) * 2}"`),
    )
    expect(reread(scaled)?.framing).toBeUndefined()
  })
})
