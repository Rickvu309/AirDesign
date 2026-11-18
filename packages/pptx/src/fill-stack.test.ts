import { expect, it } from "vitest"
import { markupDocument } from "./element-span.js"
import { shownStack, writtenStack } from "./fill-stack.js"
import { stackUri } from "./stack-extension.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"

const part = "ppt/slides/slide1.xml"
const at = { slide: "256", part, shape: "2" }
const solid = { solid: { scheme: "accent1" } } as const
const gradient = {
  gradient: {
    stops: [
      { pos: 0, color: { scheme: "accent2", transforms: [{ op: "alpha", val: 0 }] } },
      { pos: 100_000, color: { scheme: "accent2" } },
    ],
    shade: { linear: { angle: 5_400_000, scaled: false } },
    rotateWithShape: true,
  },
} as const

function slide(properties: string): Map<string, Uint8Array> {
  const xml = `<p:sld xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Card"/></p:nvSpPr>${properties}<p:txBody><a:p><a:r><a:t>Hi</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
  return new Map([[part, encodeUtf8(xml)]])
}

function xml(parts: ReadonlyMap<string, Uint8Array>): string {
  return decodeUtf8(parts.get(part)!)
}

it("writes the paints PowerPoint cannot hold in the shape's own extension, and reads them back in order", () => {
  const parts = slide(
    '<p:spPr><a:prstGeom prst="rect"/><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr>',
  )
  expect(shownStack(parts, at)).toBeNull()
  const stacked = writtenStack(parts, at, [solid, { image: true }, gradient])
  expect(markupDocument(stacked.get(part)!).wellFormed).toBe(true)
  expect(xml(stacked)).toContain(`<a:extLst><a:ext uri="${stackUri}">`)
  expect(xml(stacked).indexOf("<a:extLst>")).toBeGreaterThan(xml(stacked).indexOf("</a:solidFill>"))
  expect(shownStack(stacked, at)).toEqual([solid, { image: true }, gradient])
  expect(writtenStack(stacked, at, [solid, { image: true }, gradient])).toBe(stacked)
  expect(xml(writtenStack(stacked, at, null))).toBe(xml(parts))
})

it("keeps the shape's other extensions, and takes only its own one away", () => {
  const other = '<a:ext uri="{91240B29-F687-4F45-9708-019B960494DF}"><a14:hiddenLine xmlns:a14="a14"/></a:ext>'
  const parts = slide(`<p:spPr><a:noFill/><a:extLst>${other}</a:extLst></p:spPr>`)
  const stacked = writtenStack(parts, at, [solid, gradient])
  expect(xml(stacked)).toContain(`<a:extLst>${other}<a:ext uri="${stackUri}">`)
  expect(shownStack(stacked, at)).toEqual([solid, gradient])
  expect(xml(writtenStack(stacked, at, null))).toBe(xml(parts))
})
