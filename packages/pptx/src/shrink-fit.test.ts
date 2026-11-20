import { expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { shrunkBody } from "./shrink-fit.js"

const part = "ppt/slides/slide1.xml"

function slide(body: string): Map<string, Uint8Array> {
  const shape = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody>${body}<a:lstStyle/><a:p><a:r><a:t>A longer title</a:t></a:r></a:p></p:txBody></p:sp>`
  const other = `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr><a:normAutofit/></a:bodyPr><a:p/></p:txBody></p:sp>`
  return new Map([[part, encodeUtf8(`<p:sld><p:cSld><p:spTree>${shape}${other}</p:spTree></p:cSld></p:sld>`)]])
}

const at = { slide: "256", part, shape: "2" }

function written(parts: ReadonlyMap<string, Uint8Array>): string {
  return decodeUtf8(parts.get(part) ?? new Uint8Array())
}

it("writes the font scale and line spacing reduction the canvas painted, as PowerPoint stores a shrunk fit", () => {
  const shrunk = written(
    shrunkBody(slide("<a:bodyPr><a:normAutofit/></a:bodyPr>"), at, { scale: 0.775, reduction: 0.2 }),
  )
  expect(shrunk).toContain('<a:bodyPr><a:normAutofit fontScale="77500" lnSpcReduction="20000"/></a:bodyPr>')
  expect(shrunk).toContain(
    '<p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr><a:normAutofit/>',
  )
})

it("replaces an older fit and writes no attribute for a scale of 100% and no reduction", () => {
  const older = '<a:bodyPr anchor="b"><a:normAutofit fontScale="90000"/></a:bodyPr>'
  expect(written(shrunkBody(slide(older), at, { scale: 0.85, reduction: 0 }))).toContain(
    '<a:bodyPr anchor="b"><a:normAutofit fontScale="85000"/></a:bodyPr>',
  )
  expect(written(shrunkBody(slide(older), at, { scale: 1, reduction: 0 }))).toContain(
    '<a:bodyPr anchor="b"><a:normAutofit/></a:bodyPr>',
  )
})

it("leaves the part's bytes alone when the file already holds that fit", () => {
  const parts = slide('<a:bodyPr><a:normAutofit fontScale="92500" lnSpcReduction="10000"/></a:bodyPr>')
  expect(shrunkBody(parts, at, { scale: 0.925, reduction: 0.1 }).get(part)).toBe(parts.get(part))
})

it("writes the fit into a shape whose own body inherits shrinking from its layout", () => {
  expect(written(shrunkBody(slide("<a:bodyPr/>"), at, { scale: 0.7, reduction: 0.1 }))).toContain(
    '<a:bodyPr><a:normAutofit fontScale="70000" lnSpcReduction="10000"/></a:bodyPr>',
  )
})
