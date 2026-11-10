import { describe, expect, it } from "vitest"
import { markupDocument } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"

function element(kind: string, xml: string) {
  const found = markupDocument(encodeUtf8(xml)).elements.find((item) => item.kind === kind)
  if (found === undefined) throw new Error(kind)
  return found
}

describe("markupDocument", () => {
  it("returns byte spans for a shape and the picture after it", () => {
    const xml = `<p:sp><p:cNvPr id="2"/></p:sp><p:pic><p:cNvPr id="3"/></p:pic>`
    const document = markupDocument(encodeUtf8(xml))
    expect(document.wellFormed).toBe(true)
    const shape = element("p:sp", xml)
    const picture = element("p:pic", xml)
    expect(shape).toMatchObject({ start: 0, openEnd: 6, closeStart: 23, end: 30, selfClosing: false })
    expect(picture).toMatchObject({ start: 30, openEnd: 37, closeStart: 54, end: 62, selfClosing: false })
    expect(document.elements.find((item) => item.kind === "p:cNvPr" && item.id === "2")?.start).toBe(6)
    expect(document.elements.find((item) => item.kind === "p:cNvPr" && item.id === "3")?.start).toBe(37)
    const bytes = encodeUtf8(xml)
    expect(decodeUtf8(bytes.subarray(shape.start, shape.end))).toBe(`<p:sp><p:cNvPr id="2"/></p:sp>`)
    expect(decodeUtf8(bytes.subarray(picture.start, picture.end))).toBe(`<p:pic><p:cNvPr id="3"/></p:pic>`)
  })

  it("keeps an attribute copied from parser memory", () => {
    const first = markupDocument(encodeUtf8(`<p:cNvPr id="2"/>`))
    markupDocument(encodeUtf8(`<p:cNvPr id="9"/>`))
    expect(first.elements[0]).toMatchObject({ id: "2", selfClosing: true, start: 0, end: 17 })
    const off = element("a:off", `<a:off x="10" y="20"/>`)
    expect(off.attributes.find((item) => item.name === "x")).toMatchObject({
      value: "10",
      valueStart: 10,
      valueEnd: 12,
    })
  })

  it("spans a text run's raw bytes, including an entity", () => {
    const text = element("a:t", `<a:t>A &amp; B</a:t>`)
    expect(text).toMatchObject({ start: 0, openEnd: 5, closeStart: 14, end: 20, selfClosing: false })
    expect(encodeUtf8(`<a:t>A &amp; B</a:t>`).subarray(text.openEnd, text.closeStart)).toEqual(encodeUtf8("A &amp; B"))
    expect(element("a:t", "<a:t/>")).toMatchObject({ start: 0, end: 6, selfClosing: true })
  })

  it("keeps the real start when an open tag crosses a 64 KiB write", () => {
    const tag = `<p:pic name="a>b" id="3"/>`
    const encoded = encodeUtf8(tag)
    expect(element("p:pic", tag)).toMatchObject({ start: 0, end: encoded.length, selfClosing: true })
    for (const at of [65530, 65531, 65532, 65533, 65534, 65535, 65536]) {
      const bytes = new Uint8Array(at + encoded.length)
      bytes.fill(32)
      bytes.set(encoded, at)
      const found = markupDocument(bytes).elements.find((item) => item.kind === "p:pic")
      const id = found?.attributes.find((item) => item.name === "id")
      expect(found).toMatchObject({ start: at, end: at + encoded.length, selfClosing: true })
      expect(id).toMatchObject({ value: "3", valueStart: at + tag.indexOf("3"), valueEnd: at + tag.indexOf("3") + 1 })
    }
  })

  it("accepts comments and cdata, and refuses a doctype or a broken tag", () => {
    expect(markupDocument(encodeUtf8(`<a><![CDATA[${"<b>".repeat(4)}]]></a>`))).toMatchObject({
      wellFormed: true,
      nodes: 1,
      depth: 1,
    })
    expect(markupDocument(encodeUtf8("<a><!-- <b></b> --></a>")).wellFormed).toBe(true)
    expect(markupDocument(encodeUtf8("<a/><b/>")).wellFormed).toBe(true)
    expect(markupDocument(encodeUtf8("<!DOCTYPE a><a/>")).wellFormed).toBe(false)
    expect(markupDocument(encodeUtf8("<a>")).wellFormed).toBe(false)
    expect(markupDocument(encodeUtf8("<a></b>")).wellFormed).toBe(false)
    expect(markupDocument(encodeUtf8("<a><!--")).wellFormed).toBe(false)
  })
})
