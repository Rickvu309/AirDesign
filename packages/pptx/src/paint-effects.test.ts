import { describe, expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"

const slide = "ppt/slides/slide1.xml"
const layout = "ppt/slideLayouts/layout.xml"
const master = "ppt/slideMasters/master.xml"
const theme = "ppt/theme/theme.xml"
const black = (alpha = "") => `<a:srgbClr val="000000">${alpha}</a:srgbClr>`
const ph = `<p:ph type="title" idx="1"/>`
const sp = (properties = "", placeholder = "", style = "") =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2"/><p:nvPr>${placeholder}</p:nvPr></p:nvSpPr><p:spPr>${properties}</p:spPr>${style}</p:sp>`
const effectRef = (index: string, color = '<a:srgbClr val="336699"/>') =>
  `<p:style><a:effectRef idx="${index}">${color}</a:effectRef></p:style>`
const rels = (kind: string, target: string) =>
  `<Relationships><Relationship Id="r1" Type="r/${kind}" Target="${target}"/></Relationships>`
const partsOf = (shapes = "", inherited = "", effects = "") =>
  new Map([
    [slide, encodeUtf8(`<p:sld><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`)],
    [layout, encodeUtf8(`<p:sldLayout><p:cSld><p:spTree>${inherited}</p:spTree></p:cSld></p:sldLayout>`)],
    [master, encodeUtf8(`<p:sldMaster><p:cSld><p:spTree></p:spTree></p:cSld></p:sldMaster>`)],
    [
      theme,
      encodeUtf8(
        `<a:theme><a:themeElements><a:fmtScheme><a:effectStyleLst>${effects}</a:effectStyleLst></a:fmtScheme></a:themeElements></a:theme>`,
      ),
    ],
    ["ppt/slides/_rels/slide1.xml.rels", encodeUtf8(rels("slideLayout", "../slideLayouts/layout.xml"))],
    ["ppt/slideLayouts/_rels/layout.xml.rels", encodeUtf8(rels("slideMaster", "../slideMasters/master.xml"))],
    ["ppt/slideMasters/_rels/master.xml.rels", encodeUtf8(rels("theme", "../theme/theme.xml"))],
  ])
const effectsOf = (parts: ReadonlyMap<string, Uint8Array>) =>
  paintReader(parts)
    .slide(slide)
    .elements.find((element) => element.from === "slide")!.effects
const listed = (inside: string) => `<a:effectLst>${inside}</a:effectLst>`
const style = (inside: string) => `<a:effectStyle>${inside}</a:effectStyle>`
const shadow = (attributes: string, color = black()) => `<a:outerShdw ${attributes}>${color}</a:outerShdw>`

describe("effect paint", () => {
  const ownOf = (inside: string) => effectsOf(partsOf(sp(listed(inside))))

  it("reads every attribute of an outer shadow", () => {
    const inside = shadow(
      'blurRad="40000" dist="23000" dir="5400000" sx="90000" sy="110000" kx="60000" ky="120000" algn="tl" rotWithShape="0"',
      black('<a:alpha val="35000"/>'),
    )
    expect(ownOf(inside)).toEqual({
      shadow: {
        blur: 40000,
        distance: 23000,
        direction: 90,
        scaleX: 0.9,
        scaleY: 1.1,
        skewX: 1,
        skewY: 2,
        align: "tl",
        rotateWithShape: false,
        color: { hex: "000000", alpha: 0.35 },
      },
    })
  })

  it("gives an outer shadow with no attributes the schema defaults", () => {
    expect(ownOf(shadow(""))).toEqual({
      shadow: {
        blur: 0,
        distance: 0,
        direction: 0,
        scaleX: 1,
        scaleY: 1,
        skewX: 0,
        skewY: 0,
        align: "b",
        rotateWithShape: true,
        color: { hex: "000000", alpha: 1 },
      },
    })
  })

  it.each([
    ["1", true],
    ["true", true],
    ["0", false],
    ["false", false],
    ["maybe", true],
  ])("reads rotWithShape %s", (value, rotateWithShape) => {
    expect(ownOf(shadow(`rotWithShape="${value}"`))?.shadow?.rotateWithShape).toBe(rotateWithShape)
  })

  it("keeps a bad number at its default and a bad alignment at the default", () => {
    const read = ownOf(shadow('blurRad="-4" dist="x" dir="1.5" sx="bad" algn="middle"'))?.shadow
    expect(read).toMatchObject({ blur: 0, distance: 0, direction: 0, scaleX: 1, align: "b" })
  })

  it("reads a negative scale as a mirror", () => {
    expect(ownOf(shadow('sx="-100000" sy="-50000"'))?.shadow).toMatchObject({ scaleX: -1, scaleY: -0.5 })
  })

  it("paints no shadow when its colour is missing or not readable", () => {
    expect(ownOf("<a:outerShdw/>")).toBeUndefined()
    expect(ownOf(shadow('blurRad="9"', '<a:srgbClr val="nope"/>'))).toBeUndefined()
  })

  it("reads a glow and a soft edge", () => {
    const inside = `<a:glow rad="101600"><a:srgbClr val="FF0000"><a:alpha val="60000"/></a:srgbClr></a:glow><a:softEdge rad="63500"/>`
    expect(ownOf(inside)).toEqual({
      glow: { radius: 101600, color: { hex: "FF0000", alpha: 0.6 } },
      softEdge: { radius: 63500 },
    })
  })

  it("reads the shadow, glow and soft edge of one list together", () => {
    const inside = `<a:glow rad="1"><a:srgbClr val="00FF00"/></a:glow>${shadow('dist="5"')}<a:softEdge rad="2"/>`
    expect(Object.keys(ownOf(inside) ?? {}).sort()).toEqual(["glow", "shadow", "softEdge"])
  })

  it("leaves out the effects the file does not give and the kinds it does not paint", () => {
    expect(ownOf("")).toBeUndefined()
    expect(ownOf('<a:innerShdw blurRad="9"><a:srgbClr val="000000"/></a:innerShdw><a:reflection/>')).toEqual({
      innerShadow: { blur: 9, distance: 0, direction: 0, color: { hex: "000000", alpha: 1 } },
    })
    expect(ownOf('<a:blur rad="63500" grow="0"/>')).toEqual({ blur: { radius: 63500 } })
    expect(effectsOf(partsOf(sp()))).toBeUndefined()
  })

  it("paints no glow without a radius and no soft edge without one", () => {
    expect(ownOf('<a:glow><a:srgbClr val="FF0000"/></a:glow><a:softEdge/>')).toBeUndefined()
  })
})

describe("effect paint from the style", () => {
  const themed = style(
    listed(shadow('blurRad="40000" dist="23000" dir="5400000" rotWithShape="0"', black('<a:alpha val="35000"/>'))),
  )
  const none = style(listed(""))
  const dag = style("<a:effectDag/>")
  const withStyle = (reference: string, properties = "", styles = [none, themed].join("")) =>
    effectsOf(partsOf(sp(properties, "", reference), "", styles))

  it("reads the theme style an effectRef points at", () => {
    expect(withStyle(effectRef("2"))?.shadow).toMatchObject({
      blur: 40000,
      distance: 23000,
      direction: 90,
      rotateWithShape: false,
      color: { hex: "000000", alpha: 0.35 },
    })
  })

  it("paints no effect for index 0, an index past the list or a list with no effect", () => {
    expect(withStyle(effectRef("0"))).toBeUndefined()
    expect(withStyle(effectRef("3"))).toBeUndefined()
    expect(withStyle(effectRef("1"))).toBeUndefined()
    expect(withStyle(effectRef("one"))).toBeUndefined()
  })

  it("paints no effect from a style that holds an effect graph", () => {
    expect(withStyle(effectRef("1"), "", dag)).toBeUndefined()
  })

  it("replaces phClr with the reference's colour", () => {
    const placeheld = style(
      listed(`<a:glow rad="5"><a:schemeClr val="phClr"><a:alpha val="40000"/></a:schemeClr></a:glow>`),
    )
    expect(withStyle(effectRef("1", '<a:srgbClr val="336699"/>'), "", placeheld)?.glow?.color).toEqual({
      hex: "336699",
      alpha: 0.4,
    })
  })

  it("lets the shape's own list win over the style, even an empty one", () => {
    expect(withStyle(effectRef("2"), listed(`<a:softEdge rad="7"/>`))).toEqual({ softEdge: { radius: 7 } })
    expect(withStyle(effectRef("2"), listed(""))).toBeUndefined()
  })

  it("lets an own effect graph stop the style", () => {
    expect(withStyle(effectRef("2"), "<a:effectDag/>")).toBeUndefined()
  })
})

describe("effect paint through a placeholder", () => {
  it("takes the layout placeholder's list when the slide's shape has none", () => {
    const inherited = sp(listed(`<a:softEdge rad="9"/>`), ph)
    expect(effectsOf(partsOf(sp("", ph), inherited))).toEqual({ softEdge: { radius: 9 } })
  })

  it("lets the slide's own list win over the layout's", () => {
    const inherited = sp(listed(`<a:softEdge rad="9"/>`), ph)
    expect(effectsOf(partsOf(sp(listed(`<a:softEdge rad="3"/>`), ph), inherited))).toEqual({ softEdge: { radius: 3 } })
  })
})
