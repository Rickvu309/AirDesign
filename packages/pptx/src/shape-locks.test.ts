import { describe, expect, it } from "vitest"
import { lockedWritten, shownLocked } from "./shape-locks.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"

const part = "ppt/slides/slide1.xml"
const at = { slide: "256", part, shape: "2" }
const tags = `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"`
const encode = (text: string) => encodeUtf8(text)
const decode = (bytes: Uint8Array | undefined) => (bytes === undefined ? "" : decodeUtf8(bytes))
const slide = (shape: string) =>
  new Map([[part, encode(`<p:sld ${tags}><p:cSld><p:spTree>${shape}</p:spTree></p:cSld></p:sld>`)]])

const sp = (inner: string) => `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Box"/>${inner}<p:nvPr/></p:nvSpPr><p:spPr/></p:sp>`

describe("shape locks", () => {
  it("locks a shape with no locks as PowerPoint's no move, no resize and no rotate, and unlocks it", () => {
    const parts = slide(sp("<p:cNvSpPr/>"))
    expect(shownLocked(parts, at)).toBe(false)
    const locked = lockedWritten(parts, at, true)
    expect(decode(locked.get(part))).toContain('<p:cNvSpPr><a:spLocks noMove="1" noResize="1" noRot="1"/></p:cNvSpPr>')
    expect(shownLocked(locked, at)).toBe(true)
    const unlocked = lockedWritten(locked, at, false)
    expect(shownLocked(unlocked, at)).toBe(false)
    expect(decode(unlocked.get(part))).toContain("<p:cNvSpPr><a:spLocks/></p:cNvSpPr>")
  })

  it("keeps a shape's own locks and attributes, adding only the three it needs", () => {
    const parts = slide(sp('<p:cNvSpPr txBox="1"><a:spLocks noGrp="1" noMove="0"/><a:extLst/></p:cNvSpPr>'))
    const locked = lockedWritten(parts, at, true)
    expect(decode(locked.get(part))).toContain(
      '<p:cNvSpPr txBox="1"><a:spLocks noGrp="1" noMove="1" noResize="1" noRot="1"/><a:extLst/></p:cNvSpPr>',
    )
    expect(decode(lockedWritten(locked, at, false).get(part))).toContain(
      '<p:cNvSpPr txBox="1"><a:spLocks noGrp="1"/><a:extLst/></p:cNvSpPr>',
    )
  })

  it("puts the locks first in a shape's properties that hold other children", () => {
    const parts = slide(sp("<p:cNvSpPr><a:extLst/></p:cNvSpPr>"))
    expect(decode(lockedWritten(parts, at, true).get(part))).toContain(
      '<p:cNvSpPr><a:spLocks noMove="1" noResize="1" noRot="1"/><a:extLst/></p:cNvSpPr>',
    )
  })

  it("leaves the bytes alone when the shape already reads as asked", () => {
    const parts = slide(sp("<p:cNvSpPr/>"))
    expect(lockedWritten(parts, at, false)).toBe(parts)
  })

  it("uses each kind's own locks, and gives a table or chart frame no rotate lock, which its schema lacks", () => {
    const pic = slide(
      `<p:pic><p:nvPicPr><p:cNvPr id="2" name="Photo"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr></p:pic>`,
    )
    expect(decode(lockedWritten(pic, at, true).get(part))).toContain(
      '<a:picLocks noChangeAspect="1" noMove="1" noResize="1" noRot="1"/>',
    )
    const group = slide(
      `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="2" name="Group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:grpSp>`,
    )
    expect(decode(lockedWritten(group, at, true).get(part))).toContain(
      '<p:cNvGrpSpPr><a:grpSpLocks noMove="1" noResize="1" noRot="1"/></p:cNvGrpSpPr>',
    )
    const frame = slide(
      `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2" name="Table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr></p:graphicFrame>`,
    )
    expect(decode(lockedWritten(frame, at, true).get(part))).toContain(
      '<p:cNvGraphicFramePr><a:graphicFrameLocks noMove="1" noResize="1"/></p:cNvGraphicFramePr>',
    )
    const line = slide(
      `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="2" name="Line"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr/></p:cxnSp>`,
    )
    expect(shownLocked(lockedWritten(line, at, true), at)).toBe(true)
  })
})
