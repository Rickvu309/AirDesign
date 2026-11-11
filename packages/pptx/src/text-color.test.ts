import { describe, expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { paintReader, type PaintElement } from "./paint-reader.js"
import type { PaintParagraph, PaintRun, PaintText } from "./paint-text.js"

const slidePart = "ppt/slides/slide1.xml"
const layoutPart = "ppt/slideLayouts/slideLayout1.xml"
const masterPart = "ppt/slideMasters/slideMaster1.xml"
const themePart = "ppt/theme/theme1.xml"

const rels = (type: string, target: string) =>
  `<Relationships><Relationship Id="r1" Type="r/${type}" Target="${target}"/></Relationships>`

const sheet = (root: string, shapes: string, tail = "") =>
  `<${root}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld>${tail}</${root}>`

const run = (text = "x", format = "") => `<a:r>${format}<a:t>${text}</a:t></a:r>`
const para = (inner = run()) => `<a:p>${inner}</a:p>`

type Shape = {
  readonly id?: string
  readonly ph?: string
  readonly style?: string
  readonly body?: string
  readonly list?: string
  readonly text?: string
}

const shape = ({ id = "2", ph = "", style = "", body = "<a:bodyPr/>", list = "", text = para() }: Shape) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s"/><p:cNvSpPr/><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr/>${style}<p:txBody>${body}<a:lstStyle>${list}</a:lstStyle>${text}</p:txBody></p:sp>`

const theme = `<a:theme><a:themeElements><a:clrScheme><a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="EEEEEE"/></a:lt1><a:accent1><a:srgbClr val="804020"/></a:accent1><a:accent2><a:srgbClr val="00AA00"/></a:accent2></a:clrScheme><a:fontScheme><a:majorFont><a:latin typeface="Major Latin"/><a:ea typeface="Major East"/><a:cs typeface="Major Complex"/></a:majorFont><a:minorFont><a:latin typeface="Minor Latin"/><a:ea typeface="Minor East"/><a:cs typeface=""/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`

const clrMap = `<p:clrMap bg1="lt1" tx1="dk1" accent1="accent1" accent2="accent2"/>`

type Deck = {
  readonly slide?: string
  readonly layout?: string
  readonly master?: string
  readonly styles?: string
  readonly defaults?: string
  readonly slideTail?: string
}

const deck = ({ slide = "", layout = "", master = "", styles = "", defaults = "", slideTail = "" }: Deck) =>
  new Map<string, Uint8Array>(
    (
      [
        [
          "ppt/presentation.xml",
          `<p:presentation><p:defaultTextStyle>${defaults}</p:defaultTextStyle></p:presentation>`,
        ],
        [slidePart, sheet("p:sld", slide, slideTail)],
        ["ppt/slides/_rels/slide1.xml.rels", rels("slideLayout", "../slideLayouts/slideLayout1.xml")],
        [layoutPart, sheet("p:sldLayout", layout)],
        ["ppt/slideLayouts/_rels/slideLayout1.xml.rels", rels("slideMaster", "../slideMasters/slideMaster1.xml")],
        [masterPart, sheet("p:sldMaster", master, `${clrMap}<p:txStyles>${styles}</p:txStyles>`)],
        ["ppt/slideMasters/_rels/slideMaster1.xml.rels", rels("theme", "../theme/theme1.xml")],
        [themePart, theme],
      ] as const
    ).map(([name, text]) => [name, encodeUtf8(text)] as const),
  )

const elementOf = (input: Deck, id = "2"): PaintElement => {
  const found = paintReader(deck(input))
    .slide(slidePart)
    .elements.find((element) => element.shape === id)
  if (found === undefined) throw new Error(`shape ${id}`)
  return found
}
const textOf = (input: Deck, id = "2"): PaintText => {
  const { text } = elementOf(input, id)
  if (text === null) throw new Error(`text ${id}`)
  return text
}
const paragraphOf = (input: Deck, at = 0): PaintParagraph => {
  const paragraph = textOf(input).paragraphs[at]
  if (paragraph === undefined) throw new Error(`paragraph ${at}`)
  return paragraph
}
const runOf = (input: Deck, at = 0): PaintRun => {
  const found = paragraphOf(input).runs[at]
  if (found === undefined) throw new Error(`run ${at}`)
  return found
}

const solid = (hex: string) => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`
const color = (hex: string) => ({ hex, alpha: 1 })

describe("text color", () => {
  it("does not read a line's fill as the text color", () => {
    const format = `<a:rPr><a:ln>${solid("ABCDEF")}</a:ln></a:rPr>`
    expect(runOf({ slide: shape({ text: para(run("x", format)) }) }).color).toEqual(color("111111"))
  })

  it("falls back to the theme color that tx1 maps to when no level gives a color", () => {
    expect(runOf({ slide: shape({ text: para(run("x")) }) }).color).toEqual(color("111111"))
  })

  it("keeps an explicit no fill as no color", () => {
    expect(runOf({ slide: shape({ text: para(run("x", "<a:rPr><a:noFill/></a:rPr>")) }) }).color).toBeNull()
  })

  it("reads a:highlight on a run", () => {
    const format = `<a:rPr><a:highlight><a:srgbClr val="FFFF00"/></a:highlight></a:rPr>`
    expect(runOf({ slide: shape({ text: para(run("x", format)) }) }).highlight).toEqual(color("FFFF00"))
  })
})
