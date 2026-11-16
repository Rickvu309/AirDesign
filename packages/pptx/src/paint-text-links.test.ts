import { describe, expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"
import type { PaintRun } from "./paint-text.js"

const slidePart = "ppt/slides/slide1.xml"

const rels = (type: string, target: string) =>
  `<Relationships><Relationship Id="r1" Type="r/${type}" Target="${target}"/></Relationships>`

const sheet = (root: string, shapes: string, tail = "") =>
  `<${root}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld>${tail}</${root}>`

const shape = (format: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r>${format}<a:t>x</a:t></a:r></a:p></p:txBody></p:sp>`

const theme = `<a:theme><a:themeElements><a:clrScheme><a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="EEEEEE"/></a:lt1><a:accent1><a:srgbClr val="804020"/></a:accent1><a:hlink><a:srgbClr val="0563C1"/></a:hlink></a:clrScheme></a:themeElements></a:theme>`

const clrMap = `<p:clrMap bg1="lt1" tx1="dk1" accent1="accent1" hlink="hlink"/>`

const runOf = (format: string, slideTail = ""): PaintRun => {
  const parts = new Map<string, Uint8Array>(
    (
      [
        ["ppt/presentation.xml", `<p:presentation/>`],
        [slidePart, sheet("p:sld", shape(format), slideTail)],
        ["ppt/slides/_rels/slide1.xml.rels", rels("slideLayout", "../slideLayouts/slideLayout1.xml")],
        ["ppt/slideLayouts/slideLayout1.xml", sheet("p:sldLayout", "")],
        ["ppt/slideLayouts/_rels/slideLayout1.xml.rels", rels("slideMaster", "../slideMasters/slideMaster1.xml")],
        ["ppt/slideMasters/slideMaster1.xml", sheet("p:sldMaster", "", clrMap)],
        ["ppt/slideMasters/_rels/slideMaster1.xml.rels", rels("theme", "../theme/theme1.xml")],
        ["ppt/theme/theme1.xml", theme],
      ] as const
    ).map(([name, text]) => [name, encodeUtf8(text)] as const),
  )
  const run = paintReader(parts).slide(slidePart).elements[0]?.text?.paragraphs[0]?.runs[0]
  if (run === undefined) throw new Error("no run")
  return run
}

const link = `<a:hlinkClick r:id="rId2"/>`
const textColorLink = `<a:hlinkClick r:id="rId2"><a:extLst><a:ext uri="{A12FA001-AC4F-418D-AE19-62706E023703}"><ahyp:hlinkClr xmlns:ahyp="http://schemas.microsoft.com/office/drawing/2018/hyperlinkcolor" val="tx"/></a:ext></a:extLst></a:hlinkClick>`
const solid = (hex: string) => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`

describe("paintText hyperlinks", () => {
  it("paints a hyperlink in the theme's link color with an underline", () => {
    const run = runOf(`<a:rPr lang="en-US">${link}</a:rPr>`)
    expect([run.color, run.underline]).toEqual([{ hex: "0563C1", alpha: 1 }, true])
  })

  it("paints the link color over the run's own color, as PowerPoint does without the text color mark", () => {
    const run = runOf(`<a:rPr>${solid("FF0000")}${link}</a:rPr>`)
    expect([run.color, run.underline]).toEqual([{ hex: "0563C1", alpha: 1 }, true])
  })

  it("follows the slide's color map for the link color", () => {
    const run = runOf(`<a:rPr>${link}</a:rPr>`, `<p:clrMapOvr><a:overrideClrMapping hlink="accent1"/></p:clrMapOvr>`)
    expect(run.color).toEqual({ hex: "804020", alpha: 1 })
  })

  it("keeps the run's own color and underline when the link says to use the text color", () => {
    const own = runOf(`<a:rPr>${solid("FF0000")}${textColorLink}</a:rPr>`)
    expect([own.color, own.underline]).toEqual([{ hex: "FF0000", alpha: 1 }, false])
    const underlined = runOf(`<a:rPr u="sng">${textColorLink}</a:rPr>`)
    expect([underlined.color, underlined.underline]).toEqual([{ hex: "111111", alpha: 1 }, true])
  })

  it("leaves a run with no link alone", () => {
    const run = runOf(`<a:rPr>${solid("FF0000")}</a:rPr>`)
    expect([run.color, run.underline]).toEqual([{ hex: "FF0000", alpha: 1 }, false])
  })
})
