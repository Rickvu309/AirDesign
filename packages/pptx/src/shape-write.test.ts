import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { addDrawnShape, addTextShape, type ShapeBox } from "./shape-write.js"
import { applyRoute, writeRoute } from "./slide-route.js"

const slide = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sld>`
const box: ShapeBox = { x: 0, y: 0, cx: 914400, cy: 457200 }

describe("addTextShape", () => {
  it("assigns the next free id and builds the shape through child order", () => {
    const written = addTextShape(slide, "Tiếng Việt & < >", box)
    const xml = written.xml
    expect(written.id).toBe(2)
    expect(xml).toContain(`<p:cNvPr id="2" name="Shape 2"/>`)
    expect(xml).toContain(`<p:cNvPr id="1" name=""/>`)
    expect(xml).toContain("<a:t>Tiếng Việt &amp; &lt; &gt;</a:t>")
    expect(xml.indexOf("<a:pPr")).toBeLessThan(xml.indexOf("<a:r>"))
    expect(xml.indexOf("<a:r>")).toBeLessThan(xml.indexOf("<a:endParaRPr"))
    expect(xml.indexOf("<a:xfrm")).toBeLessThan(xml.indexOf("<a:prstGeom"))
    expect(xml.indexOf("<a:bodyPr")).toBeLessThan(xml.indexOf("<a:lstStyle"))
    expect(xml.indexOf("<a:lstStyle")).toBeLessThan(xml.indexOf("<a:p>"))
    expect(xml.indexOf("<p:spPr>")).toBeLessThan(xml.indexOf("<p:txBody>"))
    expect(xml.indexOf("<p:sp>")).toBeGreaterThan(xml.indexOf("<p:grpSpPr"))
    expect(xml.indexOf("<p:sp>")).toBeLessThan(xml.lastIndexOf("</p:spTree>"))
    const again = addTextShape(xml, "B", box)
    expect(again.id).toBe(3)
    expect(again.xml).toContain(`<p:cNvPr id="3" name="Shape 3"/>`)
    expect(again.xml.indexOf(`id="2"`)).toBeLessThan(again.xml.indexOf(`id="3"`))
    expect(addTextShape(slide, "😀", box).xml).toContain("<a:t>😀</a:t>")
  })

  it("refuses a slide with no shape tree and a box that is not an integer", () => {
    expect(() => addTextShape("<p:sld></p:sld>", "A", box)).toThrow(/p:spTree/)
    expect(() => addTextShape(slide, "A", { ...box, cx: 1.5 })).toThrow(/emu/)
  })
})

describe("addDrawnShape", () => {
  const weight = '<a:ln w="28575"'

  it("draws a line and an arrow with the same visible weight", () => {
    const line = addDrawnShape(slide, "line", box).xml
    const arrow = addDrawnShape(slide, "straightConnector1", box).xml
    expect(line).toContain(weight)
    expect(arrow).toContain(weight)
    expect(arrow).toContain('<a:tailEnd type="triangle"/>')
    expect(line.indexOf("<a:prstGeom")).toBeLessThan(line.indexOf("<a:ln"))
    expect(line.indexOf(weight)).toBeLessThan(line.indexOf("</p:spPr>"))
  })

  it("leaves a rectangle to its theme outline", () => {
    expect(addDrawnShape(slide, "rect", box).xml).not.toMatch(/<a:ln[ >]/)
  })
})

describe("a new text box with no opening text", () => {
  const kept = `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t></a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`
  const shape = (body: string) =>
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/>${body}</p:txBody></p:sp>`
  const part = "ppt/slides/slide1.xml"
  const original = `<p:spTree>${shape(`${kept}<a:p><a:r><a:t>Old</a:t></a:r></a:p>`)}</p:spTree>`

  it("takes typed text into its empty run and leaves an empty run the original wrote", () => {
    const added = writeRoute(new Map([[part, encodeUtf8(original)]]), { name: "add", part, text: "", ...box })
    const typed = applyRoute(added.parts, {
      name: "text",
      part,
      shape: added.id ?? "",
      value: [{ from: 0, runs: [{ from: 0, text: "Typed" }] }],
    })
    const value = [
      { from: 0, runs: [{ from: 0, text: "" }] },
      { from: 1, runs: [{ from: 0, text: "New" }] },
    ]
    const next = decodeUtf8(applyRoute(typed, { name: "text", part, shape: "2", value }).get(part) ?? new Uint8Array())
    expect(next.startsWith(`<p:spTree>${shape(`${kept}<a:p><a:r><a:t>New</a:t></a:r></a:p>`)}<p:sp>`)).toBe(true)
    expect(next).toContain(`<a:p><a:pPr algn="ctr"/><a:r><a:t>Typed</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`)
    expect(next.match(/<a:r>/g)).toHaveLength(3)
  })
})
