import { describe, expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"
import { withLayoutPlaceholders } from "./slide-placeholders.js"

const xml = (value: string) => encodeUtf8(value)
const slidePart = "ppt/slides/slide1.xml"
const layoutPart = "ppt/slideLayouts/slideLayout1.xml"

const sheet = (root: string, shapes: string) =>
  `<${root}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld></${root}>`

describe("withLayoutPlaceholders", () => {
  it("paints a blank slide with the layout placeholder's box", () => {
    const layout = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title" idx="0"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="10" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:spPr></p:sp>`
    const parts = new Map<string, Uint8Array>([
      ["ppt/presentation.xml", xml(`<p:presentation><p:sldSz cx="100" cy="100"/></p:presentation>`)],
      [slidePart, xml(sheet("p:sld", ""))],
      [
        "ppt/slides/_rels/slide1.xml.rels",
        xml(
          `<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`,
        ),
      ],
      [layoutPart, xml(sheet("p:sldLayout", layout))],
    ])
    const painted = paintReader(withLayoutPlaceholders(parts, slidePart, layoutPart)).slide(slidePart).elements
    const box = painted.find((element) => element.placeholder?.type === "title")?.box
    expect(box).toMatchObject({ x: 10, y: 20, width: 30, height: 40 })
  })
})
