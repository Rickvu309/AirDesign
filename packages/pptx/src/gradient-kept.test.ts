import { changedTable, type FieldValue } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { markupDocument } from "./element-span.js"
import { fillMarkup } from "./fill-markup.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readTable, writeTable } from "./table-write.js"
import { writeTrait } from "./trait-xml.js"

type Fill = Exclude<FieldValue<"fills", "p0">, { readonly image: unknown }>
type Gradient = Extract<FieldValue<"border", "fill">, { readonly gradient: unknown }>

const part = "ppt/slides/slide1.xml"
const tile = '<a:tileRect l="-20000" t="0" r="10000" b="0"/>'
const tiled = `<a:gradFill flip="xy" rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="FFFFFF"/></a:gs><a:gs pos="100000"><a:srgbClr val="000000"/></a:gs></a:gsLst><a:lin ang="0" scaled="0"/>${tile}</a:gradFill>`
const gradient: Gradient = {
  gradient: {
    stops: [
      { pos: 0, color: { scheme: "accent1" } },
      { pos: 100_000, color: { scheme: "accent2" } },
    ],
    shade: { path: { kind: "circle", focus: { l: 50_000, t: 50_000, r: 50_000, b: 50_000 } } },
    rotateWithShape: false,
  },
}
const solid: Fill = { solid: { scheme: "accent1" } }
const kept = fillMarkup(gradient)
  .xml.replace("<a:gradFill ", '<a:gradFill flip="xy" ')
  .replace("</a:gradFill>", `${tile}</a:gradFill>`)

function parts(tree: string, background = ""): Map<string, Uint8Array> {
  return new Map([[part, encodeUtf8(`<p:sld><p:cSld>${background}<p:spTree>${tree}</p:spTree></p:cSld></p:sld>`)]])
}

function shape(properties: string): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Oval"/></p:nvSpPr><p:spPr><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>${properties}</p:spPr></p:sp>`
}

function text(next: ReadonlyMap<string, Uint8Array>): string {
  const bytes = next.get(part)
  if (bytes === undefined) throw new Error("part")
  expect(markupDocument(bytes).wellFormed).toBe(true)
  return decodeUtf8(bytes)
}

function cell(properties: string): Map<string, Uint8Array> {
  const body = "<a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></a:txBody>"
  return parts(
    `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="7" name="Table 7"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/><a:tblGrid><a:gridCol w="100"/></a:tblGrid><a:tr h="100"><a:tc>${body}<a:tcPr>${properties}</a:tcPr></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`,
  )
}

function cellWritten(before: Map<string, Uint8Array>, fill: Gradient): string {
  const opened = readTable(before, part, "7")
  const value =
    opened === null ? null : changedTable(opened, { change: "fill", cells: { rows: [0, 0], columns: [0, 0] }, fill })
  if (value === null) throw new Error("table")
  return text(writeTable(before, part, "7", value))
}

describe("a gradient a change rewrites keeps the flip and tile rectangle its value does not hold", () => {
  it("keeps them on a shape's own fill, and drops them when the fill becomes another kind", () => {
    const before = parts(shape(tiled))
    const at = { slide: "256", part, shape: "2" }
    const written = text(writeTrait(before, at, "fills", { p0: { set: gradient } }))
    expect(written).toBe(text(parts(shape(kept))))
    expect(text(writeTrait(before, at, "fills", { p0: { set: solid } }))).toBe(
      text(parts(shape(fillMarkup(solid).xml))),
    )
  })

  it("keeps them on a slide's own background", () => {
    const background = (fill: string) => `<p:bg><p:bgPr>${fill}<a:effectLst/></p:bgPr></p:bg>`
    const before = parts("", background(tiled))
    const written = writeTrait(before, { slide: "256", part, shape: "slide" }, "fills", { p0: { set: gradient } })
    expect(text(written)).toBe(text(parts("", background(kept))))
  })

  it("keeps them on a line's fill", () => {
    const line = (fill: string) => `<a:ln w="12700">${fill}</a:ln>`
    const before = parts(shape(line(tiled)))
    const written = writeTrait(before, { slide: "256", part, shape: "2" }, "border", { fill: { set: gradient } })
    expect(text(written)).toBe(text(parts(shape(line(kept)))))
  })

  it("keeps them on a table cell's fill", () => {
    expect(cellWritten(cell(tiled), gradient)).toBe(text(cell(kept)))
  })
})
