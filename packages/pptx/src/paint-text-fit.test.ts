import { describe, expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"
import type { PaintText } from "./paint-text.js"

const rels = (type: string, target: string) =>
  `<Relationships><Relationship Id="r1" Type="r/${type}" Target="${target}"/></Relationships>`

const sheet = (root: string, shapes: string, tail = "") =>
  `<${root}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld>${tail}</${root}>`

const title = `<p:ph type="title"/>`

const shape = (body: string, ph = "", id = "2") =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s"/><p:cNvSpPr/><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody>${body}<a:lstStyle/><a:p><a:r><a:t>x</a:t></a:r></a:p></p:txBody></p:sp>`

const theme = `<a:theme><a:themeElements><a:clrScheme><a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="EEEEEE"/></a:lt1><a:accent1><a:srgbClr val="804020"/></a:accent1><a:accent2><a:srgbClr val="00AA00"/></a:accent2></a:clrScheme><a:fontScheme><a:majorFont><a:latin typeface="Major Latin"/><a:ea typeface="Major East"/><a:cs typeface="Major Complex"/></a:majorFont><a:minorFont><a:latin typeface="Minor Latin"/><a:ea typeface="Minor East"/><a:cs typeface=""/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`

const clrMap = `<p:clrMap bg1="lt1" tx1="dk1" accent1="accent1" accent2="accent2"/>`

function textOf(body: string, layout = ""): PaintText {
  const parts = new Map<string, Uint8Array>([
    ["ppt/presentation.xml", encodeUtf8("<p:presentation><p:defaultTextStyle/></p:presentation>")],
    ["ppt/slides/slide1.xml", encodeUtf8(sheet("p:sld", shape(body, layout === "" ? "" : title)))],
    ["ppt/slides/_rels/slide1.xml.rels", encodeUtf8(rels("slideLayout", "../slideLayouts/slideLayout1.xml"))],
    [
      "ppt/slideLayouts/slideLayout1.xml",
      encodeUtf8(sheet("p:sldLayout", layout === "" ? "" : shape(layout, title, "10"))),
    ],
    [
      "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      encodeUtf8(rels("slideMaster", "../slideMasters/slideMaster1.xml")),
    ],
    ["ppt/slideMasters/slideMaster1.xml", encodeUtf8(sheet("p:sldMaster", "", `${clrMap}<p:txStyles></p:txStyles>`))],
    ["ppt/slideMasters/_rels/slideMaster1.xml.rels", encodeUtf8(rels("theme", "../theme/theme1.xml"))],
    ["ppt/theme/theme1.xml", encodeUtf8(theme)],
  ])
  const text = paintReader(parts)
    .slide("ppt/slides/slide1.xml")
    .elements.find((element) => element.shape === "2")?.text
  if (text === null || text === undefined) throw new Error("no text")
  return text
}

describe("paint text fit", () => {
  it("reads no autofit as text that keeps its size", () => {
    expect(textOf("<a:bodyPr/>")).toMatchObject({ fit: "none", vertical: false, fontScale: 1 })
  })

  it("reads normAutofit as shrink, including one with no values", () => {
    expect(textOf(`<a:bodyPr><a:normAutofit fontScale="62500" lnSpcReduction="10000"/></a:bodyPr>`)).toMatchObject({
      fit: "shrink",
      fontScale: 0.625,
      spacingReduction: 0.1,
    })
    expect(textOf("<a:bodyPr><a:normAutofit/></a:bodyPr>")).toMatchObject({
      fit: "shrink",
      fontScale: 1,
      spacingReduction: 0,
    })
  })

  it("inherits shrink, and noAutofit clears it", () => {
    const layout = '<a:bodyPr><a:normAutofit fontScale="50000"/></a:bodyPr>'
    expect(textOf("<a:bodyPr/>", layout)).toMatchObject({ fit: "shrink", fontScale: 0.5 })
    expect(textOf("<a:bodyPr><a:noAutofit/></a:bodyPr>", layout)).toMatchObject({ fit: "none", fontScale: 1 })
  })

  it("reads spAutoFit as a shape that grows, and any vertical writing as vertical", () => {
    expect(textOf("<a:bodyPr><a:spAutoFit/></a:bodyPr>").fit).toBe("grow")
    expect(textOf(`<a:bodyPr vert="eaVert"/>`).vertical).toBe(true)
    expect(textOf(`<a:bodyPr vert="horz"/>`).vertical).toBe(false)
  })
})
