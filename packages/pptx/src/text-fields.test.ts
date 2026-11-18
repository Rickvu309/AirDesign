import { expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"
import { applyRoute } from "./slide-route.js"

const part = "ppt/slides/slide1.xml"
const body =
  '<a:p><a:pPr><a:buAutoNum type="romanUcParenR" startAt="7"/></a:pPr><a:r><a:rPr strike="dblStrike" spc="-64" sz="3200"/><a:t>Original</a:t></a:r></a:p>'
const xml = `<p:sld><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Text"/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>${body}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
const parts = new Map([[part, encodeUtf8(xml)]])

it("reads native double strike, signed letter spacing and another numbering scheme", () => {
  const paragraph = paintReader(parts).slide(part).elements[0]?.text?.paragraphs[0]
  expect(paragraph?.runs[0]).toMatchObject({ strike: true, letterSpacing: -64, size: 32 })
  expect(paragraph?.bullet).toMatchObject({ autoNumber: "romanUcParenR", number: 7 })
})

it("leaves every untouched native variant byte for byte when text is exported", () => {
  const after = applyRoute(parts, {
    name: "text",
    part,
    shape: "2",
    value: [{ from: 0, runs: [{ from: 0, text: "Original" }] }],
  })
  expect(after.get(part)).toEqual(parts.get(part))
})

it("keeps native variants when the words change", () => {
  const after = applyRoute(parts, {
    name: "text",
    part,
    shape: "2",
    value: [{ from: 0, runs: [{ from: 0, text: "Edited" }] }],
  })
  expect(decodeUtf8(after.get(part) ?? new Uint8Array())).toBe(xml.replace("Original", "Edited"))
})
