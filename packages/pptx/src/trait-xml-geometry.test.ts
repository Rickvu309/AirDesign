import { describe, expect, it } from "vitest"
import { shownGeometry } from "./geometry-read.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { writeTrait } from "./trait-xml.js"

const slidePart = "ppt/slides/slide1.xml"
const drawing = "http://schemas.openxmlformats.org/drawingml/2006/main"
const at = { slide: "256", part: slidePart, shape: "2" }
const transform = `<a:xfrm><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></a:xfrm>`
const fill = `<a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:ln w="12700"/>`

const sheet = (shapes: string) =>
  `<p:sld xmlns:a="${drawing}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:grpSpPr/>${shapes}</p:spTree></p:cSld></p:sld>`

const shape = (properties: string, tag = "p:sp", nonVisual = "p:nvSpPr") =>
  `<${tag}><${nonVisual}><p:cNvPr id="2" name="A"/></${nonVisual}>${properties}</${tag}>`

const slideOnly = (properties: string, tag?: string, nonVisual?: string) =>
  new Map([[slidePart, encodeUtf8(sheet(shape(properties, tag, nonVisual)))]])

const written = (parts: ReadonlyMap<string, Uint8Array>) => decodeUtf8(parts.get(slidePart) ?? new Uint8Array())

describe("a shape's geometry", () => {
  it("replaces the preset and its adjusts and keeps every other child of the properties byte for byte", () => {
    const parts = slideOnly(`<p:spPr>${transform}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}</p:spPr>`)
    const next = writeTrait(parts, at, "geometry", {
      shape: { set: { preset: "roundRect", adjust: { adj: 30_000 } } },
    })
    expect(written(next)).toBe(
      written(parts).replace(
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`,
        `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 30000"/></a:avLst></a:prstGeom>`,
      ),
    )
    expect(shownGeometry(next, at)).toEqual({ value: { preset: "roundRect", adjust: { adj: 30_000 } }, own: true })
  })

  it("replaces a custom geometry whole with the preset a person picks", () => {
    const custom = `<a:custGeom><a:avLst/><a:pathLst><a:path w="1" h="1"><a:moveTo><a:pt x="0" y="0"/></a:moveTo></a:path></a:pathLst></a:custGeom>`
    const parts = slideOnly(`<p:spPr>${transform}${custom}${fill}</p:spPr>`)
    expect(shownGeometry(parts, at)).toEqual({ value: null, own: true, open: true })
    const next = writeTrait(parts, at, "geometry", { shape: { set: { preset: "triangle", adjust: {} } } })
    expect(written(next)).toBe(written(parts).replace(custom, `<a:prstGeom prst="triangle"><a:avLst/></a:prstGeom>`))
  })

  it("leaves a closed custom geometry closed, and an unstroked open path closed", () => {
    const closed = `<a:custGeom><a:avLst/><a:pathLst><a:path w="1" h="1"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:lnTo><a:pt x="1" y="1"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom>`
    expect(shownGeometry(slideOnly(`<p:spPr>${transform}${closed}</p:spPr>`), at)).toEqual({ value: null, own: true })
    const quiet = `<a:custGeom><a:avLst/><a:pathLst><a:path w="1" h="1" stroke="0"><a:moveTo><a:pt x="0" y="0"/></a:moveTo></a:path></a:pathLst></a:custGeom>`
    expect(shownGeometry(slideOnly(`<p:spPr>${transform}${quiet}</p:spPr>`), at)).toEqual({ value: null, own: true })
    const later = `<a:custGeom><a:avLst/><a:pathLst><a:path w="1" h="1"><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:close/><a:moveTo><a:pt x="1" y="1"/></a:moveTo></a:path></a:pathLst></a:custGeom>`
    expect(shownGeometry(slideOnly(`<p:spPr>${transform}${later}</p:spPr>`), at)).toEqual({
      value: null,
      own: true,
      open: true,
    })
  })

  it("writes the adjusts in the preset's own order and only the ones it names", () => {
    const parts = slideOnly(`<p:spPr>${transform}${fill}</p:spPr>`)
    const next = writeTrait(parts, at, "geometry", {
      shape: { set: { preset: "rightArrow", adjust: { adj2: 2, other: 9, adj1: 1 } } },
    })
    expect(written(next)).toContain(
      `${transform}<a:prstGeom prst="rightArrow"><a:avLst><a:gd name="adj1" fmla="val 1"/><a:gd name="adj2" fmla="val 2"/></a:avLst></a:prstGeom>${fill}`,
    )
  })

  it("makes no edit when the file already shows the preset and adjusts", () => {
    const parts = slideOnly(
      `<p:spPr>${transform}<a:prstGeom prst="triangle"><a:avLst><a:gd name="adj" fmla="val 25000"/></a:avLst></a:prstGeom></p:spPr>`,
    )
    expect(writeTrait(parts, at, "geometry", { shape: { set: { preset: "triangle", adjust: { adj: 25_000 } } } })).toBe(
      parts,
    )
  })

  it("reaches a picture's and a connector's properties too", () => {
    const picture = slideOnly(
      `<p:blipFill/><p:spPr>${transform}<a:prstGeom prst="rect"/></p:spPr>`,
      "p:pic",
      "p:nvPicPr",
    )
    expect(
      written(writeTrait(picture, at, "geometry", { shape: { set: { preset: "ellipse", adjust: {} } } })),
    ).toContain(`<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>`)
    const connector = slideOnly(`<p:spPr>${transform}<a:prstGeom prst="line"/></p:spPr>`, "p:cxnSp", "p:nvCxnSpPr")
    expect(
      written(writeTrait(connector, at, "geometry", { shape: { set: { preset: "straightConnector1", adjust: {} } } })),
    ).toContain(`<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom>`)
  })
})

describe("a box's turn and flips", () => {
  it("patch the attributes of the transform itself and keep its children", () => {
    const parts = slideOnly(`<p:spPr>${transform}</p:spPr>`)
    const next = writeTrait(parts, at, "box", { rot: { set: 5_400_000 }, flipH: { set: true } })
    expect(written(next)).toContain(
      `<a:xfrm rot="5400000" flipH="1"><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></a:xfrm>`,
    )
    const back = writeTrait(next, at, "box", { rot: { set: 0 }, flipH: { set: false }, flipV: { set: false } })
    expect(written(back)).toContain(`<a:xfrm rot="0" flipH="0"><a:off x="1" y="2"/>`)
  })

  it("makes no edit for a turn of 0 and no flip on a transform that has neither", () => {
    const parts = slideOnly(`<p:spPr>${transform}</p:spPr>`)
    expect(writeTrait(parts, at, "box", { rot: { set: 0 }, flipH: { set: false }, flipV: { set: false } })).toBe(parts)
  })

  it("writes a turn and a move together on one transform", () => {
    const parts = slideOnly(`<p:spPr>${transform}</p:spPr>`)
    expect(written(writeTrait(parts, at, "box", { x: { set: 9 }, flipV: { set: true } }))).toContain(
      `<a:xfrm flipV="1"><a:off x="9" y="2"/><a:ext cx="3" cy="4"/></a:xfrm>`,
    )
  })
})
