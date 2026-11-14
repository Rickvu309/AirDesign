import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { writeTrait } from "./trait-xml.js"

const slidePart = "ppt/slides/slide1.xml"
const layoutPart = "ppt/slideLayouts/slideLayout1.xml"
const drawing = "http://schemas.openxmlformats.org/drawingml/2006/main"
const at = { slide: "256", part: slidePart, shape: "2" }
const moved = { x: { set: 11 }, y: { set: 20 }, w: { set: 30 }, h: { set: 40 } } as const

const sheet = (root: string, shapes: string, namespace = drawing) =>
  `<${root} xmlns:a="${namespace}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:grpSpPr/>${shapes}</p:spTree></p:cSld></${root}>`

const shape = (properties: string, placeholder = "") =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr>${placeholder}</p:nvPr></p:nvSpPr>${properties}<p:txBody><a:bodyPr/><a:p/></p:txBody></p:sp>`

const title = `<p:ph type="title"/>`

function slideOnly(properties: string): Map<string, Uint8Array> {
  return new Map([[slidePart, encodeUtf8(sheet("p:sld", shape(properties)))]])
}

function onLayout(slide: string, layout: string, namespace = drawing): Map<string, Uint8Array> {
  return new Map([
    [slidePart, encodeUtf8(sheet("p:sld", slide))],
    [
      "ppt/slides/_rels/slide1.xml.rels",
      encodeUtf8(
        `<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`,
      ),
    ],
    [layoutPart, encodeUtf8(sheet("p:sldLayout", layout, namespace))],
  ])
}

const written = (parts: ReadonlyMap<string, Uint8Array>) => decodeUtf8(parts.get(slidePart) ?? new Uint8Array())

describe("a slot's fields", () => {
  it("patch the attributes of an own slot in place and leave every other byte", () => {
    const parts = slideOnly(
      `<p:spPr><a:xfrm rot="60000"><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></a:xfrm><a:prstGeom prst="rect"/></p:spPr>`,
    )
    expect(written(writeTrait(parts, at, "box", moved))).toBe(
      written(parts).replace(
        `<a:off x="1" y="2"/><a:ext cx="3" cy="4"/>`,
        `<a:off x="11" y="20"/><a:ext cx="30" cy="40"/>`,
      ),
    )
  })

  it("make no edit when the slot already shows each value, or when a field says opening", () => {
    const parts = slideOnly(`<p:spPr><a:xfrm><a:off x="11" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:spPr>`)
    expect(writeTrait(parts, at, "box", moved)).toBe(parts)
    expect(writeTrait(parts, at, "box", { x: "opening", y: { set: 20 } })).toBe(parts)
  })

  it("add a missing child in schema order", () => {
    const parts = slideOnly(`<p:spPr><a:xfrm><a:ext cx="3" cy="4"/></a:xfrm></p:spPr>`)
    expect(written(writeTrait(parts, at, "box", moved))).toContain(
      `<p:spPr><a:xfrm><a:off x="11" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:spPr>`,
    )
  })

  it("open a self-closing slot and keep its attributes", () => {
    const parts = slideOnly(`<p:spPr><a:xfrm flipH="1"/></p:spPr>`)
    expect(written(writeTrait(parts, at, "box", moved))).toContain(
      `<p:spPr><a:xfrm flipH="1"><a:off x="11" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:spPr>`,
    )
  })

  it("write a new slot at its schema place when nothing is inherited", () => {
    expect(written(writeTrait(slideOnly(`<p:spPr/>`), at, "box", moved))).toContain(
      `<p:spPr><a:xfrm><a:off x="11" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:spPr>`,
    )
    expect(written(writeTrait(slideOnly(`<p:spPr><a:prstGeom prst="rect"/></p:spPr>`), at, "box", moved))).toContain(
      `<p:spPr><a:xfrm><a:off x="11" y="20"/><a:ext cx="30" cy="40"/></a:xfrm><a:prstGeom prst="rect"/></p:spPr>`,
    )
  })

  it("copy the layout placeholder's slot before patching, so its rotation stays", () => {
    const layout = shape(
      `<p:spPr><a:xfrm rot="5400000"><a:off x="10" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:spPr>`,
      title,
    )
    const parts = onLayout(shape(`<p:spPr/>`, title), layout)
    expect(written(writeTrait(parts, at, "box", moved))).toContain(
      `<p:spPr><a:xfrm rot="5400000"><a:off x="11" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:spPr>`,
    )
  })

  it("make no edit when the inherited slot already shows each value", () => {
    const layout = shape(`<p:spPr><a:xfrm><a:off x="11" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:spPr>`, title)
    const parts = onLayout(shape(`<p:spPr/>`, title), layout)
    expect(writeTrait(parts, at, "box", moved)).toBe(parts)
  })

  it("copy no slot from a part whose a: prefix names another namespace", () => {
    const layout = shape(
      `<p:spPr><a:xfrm rot="5400000"><a:off x="10" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:spPr>`,
      title,
    )
    const parts = onLayout(shape(`<p:spPr/>`, title), layout, "urn:elsewhere")
    expect(written(writeTrait(parts, at, "box", moved))).toContain(
      `<p:spPr><a:xfrm><a:off x="11" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:spPr>`,
    )
  })

  it("refuse a shape with no properties element and a length that is not whole", () => {
    const bare = new Map([
      [slidePart, encodeUtf8(sheet("p:sld", `<p:sp><p:nvSpPr><p:cNvPr id="2" name="A"/></p:nvSpPr></p:sp>`))],
    ])
    expect(() => writeTrait(bare, at, "box", moved)).toThrow(/p:spPr/)
    expect(() => writeTrait(slideOnly(`<p:spPr/>`), at, "box", { ...moved, x: { set: 1.5 } })).toThrow(/emu/)
  })
})
