import {
  changeLayout,
  decide,
  elementId,
  openRegister,
  slideId,
  type Alpha,
  type Command,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts, fadedFrames, indexPackage, orderedParts, shownAlphas } from "./index.js"
import { decodeUtf8 } from "./package-bytes.js"

const xml = (value: string) => Uint8Array.from(value, (letter) => letter.charCodeAt(0))
const part = "ppt/slides/slide1.xml"
const slide = slideId("258")
const file = [slide]
const solid = (rgb: string, alpha = "") => `<a:solidFill><a:srgbClr val="${rgb}">${alpha}</a:srgbClr></a:solidFill>`
const shape = (id: number, x: number, fill: string, text = "") =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="100000"/><a:ext cx="200000" cy="100000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}</p:spPr>${text}</p:sp>`
const words = `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US">${solid("000000")}</a:rPr><a:t>Hi</a:t></a:r></a:p></p:txBody>`
const gradient = `<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="FFFFFF"/></a:gs><a:gs pos="100000"><a:srgbClr val="000000"><a:alpha val="50000"/></a:srgbClr></a:gs></a:gsLst></a:gradFill>`
const body = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shape(3, 100000, solid("FF0000"), words)}${shape(5, 400000, solid("0000FF", '<a:alpha val="80000"/>'))}${shape(6, 700000, gradient)}</p:spTree></p:cSld></p:sld>`

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
  [
    "[Content_Types].xml",
    xml(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
    ),
  ],
])
const { slides, elements } = indexPackage(parts)
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

function framed(opacity: Alpha | null): Register {
  const changed = changeLayout(opened, { wrap: [node(3), node(5), node(6)], slide, node: node(20), backdrop: node(21) })
  if (changed === null || !("slide" in changed)) throw new Error("wrap")
  const filled = { v: 13, patch: { fills: { p0: { set: { solid: { rgb: "00FF00" } } } } }, node: node(21) }
  const faded: readonly Command[] =
    opacity === null
      ? []
      : [{ command: "person", v: 13, patch: { layout: { opacity: { set: opacity } } }, node: node(20) }]
  return ran(opened, [{ command: "slide", file, edit: changed.slide }, { command: "person", ...filled }, ...faded])
}

function written(register: Register) {
  const edited = exportParts(orderedParts(parts, register), register)
  return fadedFrames(edited, register)
}

const at = (shape: number) => ({ slide: "258", part, shape: String(shape) })

describe("a faded frame in PowerPoint", () => {
  it("multiplies the frame's opacity into the alpha of its backdrop and of every child", () => {
    const shown = written(framed(50_000 as Alpha))
    expect(shownAlphas(shown, at(21)).fills).toBe(50_000)
    expect(shownAlphas(shown, at(3))).toEqual({ fills: 50_000, border: null, text: 50_000 })
    expect(shownAlphas(shown, at(5)).fills).toBe(40_000)
  })

  it("fades each stop of a gradient whose stops differ in alpha by the frame's opacity", () => {
    const text = decodeUtf8(written(framed(50_000 as Alpha)).get(part) ?? new Uint8Array())
    expect(text).toContain(
      '<a:gs pos="0"><a:srgbClr val="FFFFFF"><a:alpha val="50000"/></a:srgbClr></a:gs><a:gs pos="100000"><a:srgbClr val="000000"><a:alpha val="25000"/></a:srgbClr></a:gs>',
    )
  })

  it("leaves an opaque frame's layers as the export wrote them", () => {
    const register = framed(null)
    const edited = exportParts(orderedParts(parts, register), register)
    expect(decodeUtf8(fadedFrames(edited, register).get(part) ?? new Uint8Array())).toBe(
      decodeUtf8(edited.get(part) ?? new Uint8Array()),
    )
  })
})
