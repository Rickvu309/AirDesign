import { describe, expect, it } from "vitest"
import { addTextShape, type ShapeBox } from "./shape-write.js"

const slide = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sld>`
const box: ShapeBox = { x: 0, y: 0, cx: 914400, cy: 457200 }

describe("addTextShape", () => {
  it("assigns the next free id and builds the shape through child order", () => {
    const xml = addTextShape(slide, "Tiếng Việt & < >", box)
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
    expect(again).toContain(`<p:cNvPr id="3" name="Shape 3"/>`)
    expect(again.indexOf(`id="2"`)).toBeLessThan(again.indexOf(`id="3"`))
    expect(addTextShape(slide, "😀", box)).toContain("<a:t>😀</a:t>")
  })

  it("writes the id it was given", () => {
    const xml = addTextShape(slide, "A", box, 9)
    expect(xml).toContain(`<p:cNvPr id="9" name="Shape 9"/>`)
    expect(() => addTextShape(slide, "A", box, 0)).toThrow(/shape id/)
  })

  it("refuses a slide with no shape tree and a box that is not an integer", () => {
    expect(() => addTextShape("<p:sld></p:sld>", "A", box)).toThrow(/p:spTree/)
    expect(() => addTextShape(slide, "A", { ...box, cx: 1.5 })).toThrow(/emu/)
  })
})
