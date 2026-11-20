import type { TextValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { applyRoute } from "./slide-route.js"

const part = "ppt/slides/slide1.xml"
const slide = (body: string) =>
  `<p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:bodyPr/>${body}</p:txBody></p:sp></p:spTree>`
const paragraph = (properties: string, text: string) => `<a:p>${properties}<a:r><a:t>${text}</a:t></a:r></a:p>`
const bullet = '<a:pPr marL="285750" indent="-285750"><a:buFont typeface="Arial"/><a:buChar char="•"/></a:pPr>'
const numbered = '<a:pPr marL="457200" indent="-457200"><a:buAutoNum type="arabicPeriod"/></a:pPr>'

function written(body: string, value: TextValue): string {
  const after = applyRoute(new Map([[part, encodeUtf8(slide(body))]]), { name: "text", part, shape: "2", value }).get(
    part,
  )
  if (after === undefined) throw new Error("part")
  return decodeUtf8(after)
}

const item = (from: number, text: string, more: Partial<TextValue[number]> = {}): TextValue[number] => ({
  from,
  runs: [{ from: 0, text }],
  ...more,
})

it("writes a bulleted item's level as lvl with its own marL and indent and keeps its bullet", () => {
  const body = paragraph(bullet, "One") + paragraph(bullet, "Two")
  expect(written(body, [item(0, "One"), item(1, "Two", { level: 1 })])).toBe(
    slide(
      paragraph(bullet, "One") +
        paragraph(
          '<a:pPr marL="742950" indent="-285750" lvl="1"><a:buFont typeface="Arial"/><a:buChar char="•"/></a:pPr>',
          "Two",
        ),
    ),
  )
})

it("rotates a numbered item's numbering with its level and hangs it further", () => {
  const body = paragraph(numbered, "One")
  expect(written(body, [item(0, "One", { level: 1 })])).toBe(
    slide(
      paragraph('<a:pPr marL="914400" indent="-457200" lvl="1"><a:buAutoNum type="alphaLcPeriod"/></a:pPr>', "One"),
    ),
  )
  expect(written(body, [item(0, "One", { level: 2 })])).toContain(
    '<a:pPr marL="1371600" indent="-457200" lvl="2"><a:buAutoNum type="romanLcPeriod"/></a:pPr>',
  )
})

it("drops lvl at the first level and writes that level's indent", () => {
  const deep = '<a:pPr marL="742950" lvl="1" indent="-285750"><a:buChar char="•"/></a:pPr>'
  expect(written(paragraph(deep, "One"), [item(0, "One", { level: 0 })])).toBe(
    slide(paragraph('<a:pPr marL="285750" indent="-285750"><a:buChar char="•"/></a:pPr>', "One")),
  )
})

it("creates the properties of a plain paragraph that takes a list and a level", () => {
  expect(written(paragraph("", "One"), [item(0, "One", { list: "bullets", level: 1 })])).toBe(
    slide(paragraph('<a:pPr marL="742950" lvl="1" indent="-285750"><a:buChar char="•"/></a:pPr>', "One")),
  )
  expect(written(paragraph("", "One"), [item(0, "One", { list: "numbers", level: 1 })])).toContain(
    '<a:buAutoNum type="alphaLcPeriod"/>',
  )
})

it("keeps every byte of an item whose level does not change", () => {
  const body = paragraph('<a:pPr marL="742950" lvl="1" indent="-285750"><a:buChar char="–"/></a:pPr>', "Deep")
  expect(written(body, [item(0, "Deep")])).toBe(slide(body))
})

it("hangs a list a person turns on at its level, as PowerPoint does in a text box", () => {
  expect(written(paragraph("", "One"), [item(0, "One", { list: "bullets" })])).toBe(
    slide(paragraph('<a:pPr marL="285750" indent="-285750"><a:buChar char="•"/></a:pPr>', "One")),
  )
  const deep = '<a:pPr lvl="2"><a:buNone/></a:pPr>'
  expect(written(paragraph(deep, "One"), [item(0, "One", { list: "numbers" })])).toBe(
    slide(
      paragraph('<a:pPr lvl="2" marL="1371600" indent="-457200"><a:buAutoNum type="romanLcPeriod"/></a:pPr>', "One"),
    ),
  )
})

it("writes a fixed line height as PowerPoint's exact spacing in points", () => {
  const spaced = '<a:pPr><a:lnSpc><a:spcPct val="150000"/></a:lnSpc></a:pPr>'
  expect(written(paragraph(spaced, "One"), [item(0, "One", { lineHeightPoints: 2400 })])).toBe(
    slide(paragraph('<a:pPr><a:lnSpc><a:spcPts val="2400"/></a:lnSpc></a:pPr>', "One")),
  )
  expect(written(paragraph("", "One"), [item(0, "One", { lineHeightPoints: 1800 })])).toBe(
    slide(paragraph('<a:pPr><a:lnSpc><a:spcPts val="1800"/></a:lnSpc></a:pPr>', "One")),
  )
})
