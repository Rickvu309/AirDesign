import { describe, expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"
import type { PaintText } from "./paint-text.js"

const slidePart = "ppt/slides/slide1.xml"

const rels = (type: string, target: string) =>
  `<Relationships><Relationship Id="r1" Type="r/${type}" Target="${target}"/></Relationships>`

const sheet = (root: string, shapes: string) => `<${root}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></${root}>`

const shape = (id: string, body: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody>${body}<a:lstStyle/><a:p><a:r><a:t>x</a:t></a:r></a:p></p:txBody></p:sp>`

const textOf = (slide: string, layout = ""): PaintText => {
  const parts = new Map<string, Uint8Array>(
    (
      [
        ["ppt/presentation.xml", `<p:presentation/>`],
        [slidePart, sheet("p:sld", shape("2", slide))],
        ["ppt/slides/_rels/slide1.xml.rels", rels("slideLayout", "../slideLayouts/slideLayout1.xml")],
        ["ppt/slideLayouts/slideLayout1.xml", sheet("p:sldLayout", layout === "" ? "" : shape("3", layout))],
        ["ppt/slideLayouts/_rels/slideLayout1.xml.rels", rels("slideMaster", "../slideMasters/slideMaster1.xml")],
        ["ppt/slideMasters/slideMaster1.xml", sheet("p:sldMaster", "")],
      ] as const
    ).map(([name, text]) => [name, encodeUtf8(text)] as const),
  )
  const text = paintReader(parts).slide(slidePart).elements[0]?.text
  if (text == null) throw new Error("no text")
  return text
}

describe("paintText edge spacing", () => {
  it("leaves out the first paragraph's space before and the last one's space after unless the body asks for them", () => {
    expect(textOf(`<a:bodyPr/>`).edgeSpacing).toBeUndefined()
    expect(textOf(`<a:bodyPr spcFirstLastPara="0"/>`).edgeSpacing).toBeUndefined()
    expect(textOf(`<a:bodyPr spcFirstLastPara="1"/>`).edgeSpacing).toBe(true)
  })

  it("inherits the flag from the layout's placeholder", () => {
    expect(textOf(`<a:bodyPr/>`, `<a:bodyPr spcFirstLastPara="1"/>`).edgeSpacing).toBe(true)
    expect(textOf(`<a:bodyPr spcFirstLastPara="0"/>`, `<a:bodyPr spcFirstLastPara="1"/>`).edgeSpacing).toBeUndefined()
  })
})
