import { describe, expect, it } from "vitest"
import { markupDocument } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { applyRoute, type ShapeFill } from "./slide-route.js"

const part = "ppt/slides/slide1.xml"
const rels = "ppt/slides/_rels/slide1.xml.rels"
const solid = '<a:solidFill><a:srgbClr val="19a7E8"/></a:solidFill>'
const beforeGeometry = '<a:xfrm/><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
const afterGeometry = "<a:ln><a:noFill/></a:ln><a:effectLst/><a:scene3d/><a:sp3d/><a:extLst/>"
const style = '<p:style><a:fillRef idx="2"><a:schemeClr val="accent2"/></a:fillRef></p:style>'

function slide(properties: string, kind = "p:sp", extra = ""): string {
  return `<?xml version="1.0"?><p:sld><p:cSld><p:spTree><${kind}><p:nvSpPr><p:cNvPr id="2" name="日本語 &amp; café"/></p:nvSpPr>${properties}${style}${extra}</${kind}><p:sp><p:cNvPr id="3"/><p:spPr><a:gradFill/></p:spPr></p:sp></p:spTree></p:cSld></p:sld>`
}

function parts(xml: string, name = part): Map<string, Uint8Array> {
  return new Map([
    [name, encodeUtf8(xml)],
    [rels, encodeUtf8('<Relationships><Relationship Id="rId2" Target="../media/image1.png"/></Relationships>')],
    ["ppt/media/image1.png", new Uint8Array([0, 255, 20])],
  ])
}

function write(xml: string, value: ShapeFill = { kind: "srgb", value: "19a7E8" }, name = part): string {
  const before = parts(xml, name)
  const snapshot = new Map([...before].map(([name, bytes]) => [name, bytes.slice()]))
  const next = applyRoute(before, { name: "spPr.fill", part: name, shape: "2", value })
  expect(before).toEqual(snapshot)
  for (const [other, bytes] of before) {
    if (other !== name) expect(next.get(other)).toBe(bytes)
  }
  const bytes = next.get(name)
  if (bytes === undefined) throw new Error("part")
  expect(markupDocument(bytes).wellFormed).toBe(true)
  return decodeUtf8(bytes)
}

function refuses(xml: string, error: string, value: ShapeFill = { kind: "none" }) {
  const before = parts(xml)
  const snapshot = new Map([...before].map(([name, bytes]) => [name, bytes.slice()]))
  expect(() => applyRoute(before, { name: "spPr.fill", part, shape: "2", value })).toThrow(error)
  expect(before).toEqual(snapshot)
}

describe("spPr.fill", () => {
  it.each(["", beforeGeometry, "<a:custGeom/>"])("inserts absent fill in schema order after %s", (geometry) => {
    const xml = slide(`<p:spPr bwMode='auto'>${geometry} \n${afterGeometry}</p:spPr>`)
    expect(write(xml)).toBe(xml.replace(`${geometry} \n`, `${geometry}${solid} \n`))
  })

  it("expands self-closing properties without losing attributes or inherited style", () => {
    const xml = slide("<p:spPr bwMode='auto' />")
    expect(write(xml)).toBe(xml.replace("<p:spPr bwMode='auto' />", `<p:spPr bwMode='auto' >${solid}</p:spPr>`))
  })

  it.each([
    "<a:noFill/>",
    '<a:solidFill><a:schemeClr val="accent1"><a:lumMod val="50000"/><a:alpha val="75000"/></a:schemeClr></a:solidFill>',
    '<a:solidFill><a:srgbClr val="FFFFFF"><a:alpha val="50000"/></a:srgbClr></a:solidFill>',
    '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="FFFFFF"/></a:gs></a:gsLst><a:lin ang="0"/></a:gradFill>',
    '<a:pattFill prst="pct5"><a:fgClr><a:srgbClr val="FFFFFF"/></a:fgClr></a:pattFill>',
    "<a:grpFill/>",
  ])("replaces the entire fill and only its bytes: %s", (fill) => {
    const xml = slide(`<p:spPr>${beforeGeometry}\n${fill}\r\n${afterGeometry}</p:spPr>`)
    expect(write(xml)).toBe(xml.replace(fill, solid))
    const none = write(xml, { kind: "none" })
    expect(none).toBe(xml.replace(fill, "<a:noFill/>"))
  })

  it.each([
    "dk1",
    "lt1",
    "dk2",
    "lt2",
    "accent1",
    "accent2",
    "accent3",
    "accent4",
    "accent5",
    "accent6",
    "hlink",
    "folHlink",
    "bg1",
    "tx1",
    "bg2",
    "tx2",
  ])("sets theme color %s", (value) => {
    const xml = slide("<p:spPr></p:spPr>")
    expect(write(xml, { kind: "theme", value })).toBe(
      xml.replace("</p:spPr>", `<a:solidFill><a:schemeClr val="${value}"/></a:solidFill></p:spPr>`),
    )
  })

  it("inserts no fill without an existing fill", () => {
    const xml = slide(`<p:spPr>${beforeGeometry}${afterGeometry}</p:spPr>`)
    expect(write(xml, { kind: "none" })).toBe(xml.replace(afterGeometry, `<a:noFill/>${afterGeometry}`))
  })

  it.each(["p:pic", "p:grpSp", "p:graphicFrame", "p:cxnSp"])("refuses %s without writing", (kind) => {
    refuses(slide("<p:spPr/>", kind), "fill-shape")
  })

  it.each(["", '<p:pic><p:cNvPr id="4"/><p:blipFill><a:blip r:embed="rId2"/></p:blipFill></p:pic>'])(
    "refuses picture fills whether their relationship is shared: %s",
    (extra) => {
      refuses(
        slide('<p:spPr><a:blipFill><a:blip r:embed="rId2"/><a:stretch/></a:blipFill></p:spPr>', "p:sp", extra),
        "fill-relationship",
      )
    },
  )

  it.each([
    { kind: "srgb", value: "FFF" },
    { kind: "srgb", value: '000000"/><a:noFill/>' },
    { kind: "theme", value: "unknown" },
    { kind: "theme", value: "phClr" },
  ] as const)("refuses invalid colors without writing: %s", (value) => {
    refuses(slide("<p:spPr/>"), "fill-color", value)
  })

  it("refuses missing, duplicate properties and multiple fill choices", () => {
    refuses(slide(""), "fill-properties")
    refuses(slide("<p:spPr/><p:spPr/>"), "fill-properties")
    refuses(slide("<p:spPr><a:noFill/><a:solidFill/></p:spPr>"), "fill-choice")
  })

  it("addresses a nested shape without changing its parent or sibling", () => {
    const child = slide("<p:spPr><a:noFill/></p:spPr>")
    const xml = `<p:grpSp><p:cNvPr id="8"/><p:grpSpPr/>${child}</p:grpSp>`
    expect(write(xml)).toBe(xml.replace("<a:noFill/>", solid))
  })

  it.each([
    ["ppt/slideLayouts/slideLayout1.xml", "p:sldLayout"],
    ["ppt/slideMasters/slideMaster1.xml", "p:sldMaster"],
  ])("sets the fill of a shape on %s", (name, root) => {
    const xml = slide("<p:spPr><a:noFill/></p:spPr>").replace("<p:sld>", `<${root}>`).replace("</p:sld>", `</${root}>`)
    expect(write(xml, { kind: "srgb", value: "19a7E8" }, name)).toBe(xml.replace("<a:noFill/>", solid))
  })

  it("sets a shape fill in a part with a table cell fill and leaves the cell fill as written", () => {
    const cell = '<a:tcPr marL="0"><a:solidFill><a:srgbClr val="00FF00"/></a:solidFill></a:tcPr>'
    const frame = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="5" name="Table"/></p:nvGraphicFramePr><a:graphic><a:graphicData><a:tbl><a:tr h="1"><a:tc><a:txBody><a:bodyPr/><a:p/></a:txBody>${cell}</a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
    const xml = slide("<p:spPr><a:noFill/></p:spPr>").replace("<p:spTree>", `<p:spTree>${frame}`)
    const written = write(xml)
    expect(written).toBe(xml.replace("<a:noFill/>", solid))
    expect(written).toContain(cell)
  })
})
