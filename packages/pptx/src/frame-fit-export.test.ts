import {
  decide,
  elementId,
  fitFrameRows,
  format,
  openRegister,
  plainFrameTurn,
  slideId,
  type Command,
  type ElementId,
  type ElementPatch,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts, indexPackage, orderedParts, paintReader, type PaintBox } from "./index.js"

const xml = (value: string) => Uint8Array.from(value, (letter) => letter.charCodeAt(0))
const part = "ppt/slides/slide1.xml"
const slide = slideId("258")
const file = [slide]

const shape = (id: number, x: number, y: number, cx: number, cy: number) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>`

const body = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shape(3, 100000, 100000, 200000, 100000)}${shape(5, 400000, 300000, 100000, 100000)}</p:spTree></p:cSld></p:sld>`

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

function set(register: Register, target: ElementId, patch: ElementPatch): Register {
  return ran(register, [{ command: "person", v: format, patch, node: target }])
}

function painted(shown: ReadonlyMap<string, Uint8Array>, id: number): PaintBox {
  const box = paintReader(shown)
    .slide(part)
    .elements.find((each) => each.shape === String(id))?.box
  if (box === undefined || box === null) throw new Error(`missing ${String(id)}`)
  return box
}

describe("plain frame resize-to-fit export", () => {
  it("exports the tightened frame, its backdrop, and unchanged child boxes cleanly", () => {
    const turn = plainFrameTurn(opened, file, slide, node(20), node(21), [node(3), node(5)])
    if (turn === null) throw new Error("plain frame")
    const framed = ran(opened, turn)
    const enlarged = set(
      set(
        set(framed, node(20), {
          box: { x: { set: 40000 }, y: { set: 40000 }, w: { set: 700000 }, h: { set: 500000 } },
        }),
        node(3),
        { box: { x: { set: 60000 }, y: { set: 60000 } } },
      ),
      node(5),
      { box: { x: { set: 360000 }, y: { set: 260000 } } },
    )
    const rows = fitFrameRows(enlarged, node(20))
    if (rows === null) throw new Error("fit rows")
    const fitted = ran(
      enlarged,
      rows.map((row): Command => ({ command: "person", v: format, patch: row.patch, node: row.node })),
    )
    const out = exportParts(orderedParts(parts, fitted), fitted)
    expect(painted(out, 20)).toMatchObject({ x: 100000, y: 100000, width: 400000, height: 300000 })
    expect(painted(out, 21)).toMatchObject({ x: 100000, y: 100000, width: 400000, height: 300000 })
    expect(painted(out, 3)).toMatchObject({ x: 100000, y: 100000, width: 200000, height: 100000 })
    expect(painted(out, 5)).toMatchObject({ x: 400000, y: 300000, width: 100000, height: 100000 })
    const reindexed = indexPackage(out).elements.find((each) => each.node === node(20))
    expect(reindexed?.box).toEqual({ x: 100000, y: 100000, cx: 400000, cy: 300000 })
    expect(reindexed?.framing?.layout.flow).toBe("none")
  })
})
