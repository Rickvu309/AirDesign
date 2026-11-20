import { describe, expect, it } from "vitest"
import { maskWritten, shownMask } from "./mask-extension.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"

const part = "ppt/slides/slide1.xml"
const at = { slide: "256", part, shape: "2" }
const tags = `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"`
const decode = (bytes: Uint8Array | undefined) => (bytes === undefined ? "" : decodeUtf8(bytes))
const slide = (shape: string) =>
  new Map([[part, encodeUtf8(`<p:sld ${tags}><p:cSld><p:spTree>${shape}</p:spTree></p:cSld></p:sld>`)]])

const sp = (properties: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Oval"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>${properties}</p:sp>`

describe("a mask is an AirDesign extension of the shape's properties", () => {
  it("makes a shape a mask and back, leaving the shape as it was", () => {
    const parts = slide(sp('<p:spPr><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom></p:spPr>'))
    expect(shownMask(parts, at)).toBe(false)
    const masked = maskWritten(parts, at, true)
    expect(shownMask(masked, at)).toBe(true)
    expect(decode(masked.get(part))).toContain('<a:avLst/></a:prstGeom><a:extLst><a:ext uri="')
    const released = maskWritten(masked, at, false)
    expect(shownMask(released, at)).toBe(false)
    expect(decode(released.get(part))).toBe(decode(parts.get(part)))
  })

  it("writes into empty properties and keeps another extension beside its own", () => {
    const empty = maskWritten(slide(sp("<p:spPr/>")), at, true)
    expect(shownMask(empty, at)).toBe(true)
    const other = '<a:extLst><a:ext uri="{C3A91E40-7B2D-4F6A-8E15-9D0A2B4C6E18}"/></a:extLst>'
    const kept = slide(sp(`<p:spPr>${other}</p:spPr>`))
    const both = maskWritten(kept, at, true)
    expect(decode(both.get(part))).toContain('<a:ext uri="{C3A91E40-7B2D-4F6A-8E15-9D0A2B4C6E18}"/><a:ext uri="')
    expect(decode(maskWritten(both, at, false).get(part))).toBe(decode(kept.get(part)))
  })

  it("leaves the bytes alone when the shape already reads as asked", () => {
    const parts = slide(sp("<p:spPr/>"))
    expect(maskWritten(parts, at, false)).toBe(parts)
    const masked = maskWritten(parts, at, true)
    expect(maskWritten(masked, at, true)).toBe(masked)
  })

  it("reads a picture's mask too", () => {
    const pic = slide(
      `<p:pic><p:nvPicPr><p:cNvPr id="2" name="Photo"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill/><p:spPr/></p:pic>`,
    )
    expect(shownMask(maskWritten(pic, at, true), at)).toBe(true)
  })
})
