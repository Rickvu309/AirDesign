import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"
import { withLayoutPlaceholders } from "./slide-placeholders.js"
import { applyRoute } from "./slide-route.js"

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

  it("gives a text placeholder an empty text body that takes typed text, and a picture placeholder none", () => {
    const title = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>`
    const picture = `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Picture"/><p:cNvSpPr/><p:nvPr><p:ph type="pic" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>`
    const parts = new Map<string, Uint8Array>([
      [slidePart, xml(sheet("p:sld", ""))],
      [layoutPart, xml(sheet("p:sldLayout", title + picture))],
    ])
    const placed = withLayoutPlaceholders(parts, slidePart, layoutPart)
    const written = decodeUtf8(placed.get(slidePart) ?? new Uint8Array())
    expect(written).toContain(
      `<p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`,
    )
    expect(written).toContain(`<p:ph type="pic" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>`)
    const typed = applyRoute(placed, {
      name: "text",
      part: slidePart,
      shape: "2",
      value: [{ from: 0, runs: [{ from: -1, text: "Typed" }] }],
    })
    expect(decodeUtf8(typed.get(slidePart) ?? new Uint8Array())).toContain("<a:p><a:r><a:t>Typed</a:t></a:r></a:p>")
  })

  it("copies the layout text frame so a typed title keeps its size and alignment", () => {
    const title = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="ctrTitle" idx="0"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"><a:defRPr sz="4400"/></a:pPr><a:r><a:t>Prompt</a:t></a:r><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`
    const parts = new Map<string, Uint8Array>([
      ["ppt/presentation.xml", xml(`<p:presentation><p:sldSz cx="100" cy="100"/></p:presentation>`)],
      [slidePart, xml(sheet("p:sld", ""))],
      [layoutPart, xml(sheet("p:sldLayout", title))],
    ])
    const placed = withLayoutPlaceholders(parts, slidePart, layoutPart)
    const written = decodeUtf8(placed.get(slidePart) ?? new Uint8Array())
    expect(written).toContain(`<a:bodyPr anchor="ctr"/>`)
    expect(written).toContain(`<a:pPr algn="ctr"><a:defRPr sz="4400"/></a:pPr>`)
    expect(written).not.toContain("Prompt")
    const typed = applyRoute(placed, {
      name: "text",
      part: slidePart,
      shape: "2",
      value: [{ from: 0, runs: [{ from: -1, text: "Typed" }] }],
    })
    const after = decodeUtf8(typed.get(slidePart) ?? new Uint8Array())
    expect(after).toContain(`<a:pPr algn="ctr"><a:defRPr sz="4400"/></a:pPr>`)
    expect(after).toContain("<a:t>Typed</a:t>")
    const text = paintReader(typed)
      .slide(slidePart)
      .elements.find((element) => element.placeholder?.type === "ctrTitle")?.text
    expect(text?.anchor).toBe("middle")
    expect(text?.paragraphs[0]).toMatchObject({ align: "center", endStyle: { size: 44 } })
  })
})
