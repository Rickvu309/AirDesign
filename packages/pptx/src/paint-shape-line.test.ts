import { describe, expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"

const slide = "ppt/slides/slide1.xml"
const layout = "ppt/slideLayouts/layout.xml"
const master = "ppt/slideMasters/master.xml"
const theme = "ppt/theme/theme.xml"
const solid = (hex: string) => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`
const expected = (hex: string) => ({ type: "solid", color: { hex, alpha: 1 } })
const ph = (type = "title", index = "1") => `<p:ph type="${type}" idx="${index}"/>`
const sp = (properties = "", placeholder = "", style = "") =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2"/><p:nvPr>${placeholder}</p:nvPr></p:nvSpPr><p:spPr>${properties}</p:spPr>${style}</p:sp>`
const ref = (kind: string, index: string, color = '<a:srgbClr val="336699"/>') =>
  `<p:style><a:${kind}Ref idx="${index}">${color}</a:${kind}Ref></p:style>`
const rels = (kind: string, target: string) =>
  `<Relationships><Relationship Id="r1" Type="r/${kind}" Target="${target}"/></Relationships>`
const partsOf = (shapes = "", inherited = "", base = "", fills = "", lines = "") =>
  new Map([
    [slide, encodeUtf8(`<p:sld><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`)],
    [layout, encodeUtf8(`<p:sldLayout><p:cSld><p:spTree>${inherited}</p:spTree></p:cSld></p:sldLayout>`)],
    [master, encodeUtf8(`<p:sldMaster><p:cSld><p:spTree>${base}</p:spTree></p:cSld></p:sldMaster>`)],
    [
      theme,
      encodeUtf8(
        `<a:theme><a:themeElements><a:fmtScheme><a:fillStyleLst>${fills}</a:fillStyleLst><a:lnStyleLst>${lines}</a:lnStyleLst></a:fmtScheme></a:themeElements></a:theme>`,
      ),
    ],
    ["ppt/slides/_rels/slide1.xml.rels", encodeUtf8(rels("slideLayout", "../slideLayouts/layout.xml"))],
    ["ppt/slideLayouts/_rels/layout.xml.rels", encodeUtf8(rels("slideMaster", "../slideMasters/master.xml"))],
    ["ppt/slideMasters/_rels/master.xml.rels", encodeUtf8(rels("theme", "../theme/theme.xml"))],
  ])
const own = (parts: ReadonlyMap<string, Uint8Array>) =>
  paintReader(parts)
    .slide(slide)
    .elements.find((element) => element.from === "slide")!
const line = { fill: { type: "none" }, width: 9525, dash: null, head: null, tail: null }

describe("line style paint", () => {
  const lined = (attributes: string, inside = "") => `<a:ln ${attributes}>${inside}</a:ln>`
  const lineOf = (shape: string, inherited = "", base = "", styles = "", style = "") =>
    own(partsOf(sp(shape, inherited === "" ? "" : ph(), style), inherited, base, "", styles)).line

  it.each(["rnd", "sq", "flat"])("reads the cap %s", (cap) => {
    expect(lineOf(lined(`cap="${cap}"`))?.cap).toBe(cap)
  })

  it.each(["sng", "dbl", "thickThin", "thinThick", "tri"])("reads the compound %s", (compound) => {
    expect(lineOf(lined(`cmpd="${compound}"`))?.compound).toBe(compound)
  })

  it("leaves cap, compound, join, dashes and sizes out when the file gives none", () => {
    expect(lineOf(lined('w="100"', '<a:headEnd type="triangle"/>'))).toEqual({
      ...line,
      width: 100,
      head: "triangle",
    })
  })

  it.each([
    ["<a:round/>", { kind: "round" }],
    ["<a:bevel/>", { kind: "bevel" }],
    ["<a:miter/>", { kind: "miter" }],
    ['<a:miter lim="800000"/>', { kind: "miter", limit: 8 }],
    ['<a:miter lim="bad"/>', { kind: "miter" }],
  ])("reads the join %s", (inside, join) => {
    expect(lineOf(lined("", inside))?.join).toEqual(join)
  })

  it("reads a custom dash as steps of the line width", () => {
    const inside = '<a:custDash><a:ds d="400000" sp="100000"/><a:ds d="50000" sp="250000"/></a:custDash>'
    expect(lineOf(lined("", inside))?.dashes).toEqual([
      { dash: 4, space: 1 },
      { dash: 0.5, space: 2.5 },
    ])
  })

  it("skips a custom dash step with a bad length", () => {
    const inside = '<a:custDash><a:ds d="bad" sp="100000"/><a:ds d="100000" sp="100000"/></a:custDash>'
    expect(lineOf(lined("", inside))?.dashes).toEqual([{ dash: 1, space: 1 }])
  })

  it.each([
    ["headEnd", "headWidth", "sm"],
    ["headEnd", "headLength", "lg"],
    ["tailEnd", "tailWidth", "lg"],
    ["tailEnd", "tailLength", "sm"],
  ])("reads the %s size into %s", (end, field, size) => {
    const attribute = field.endsWith("Width") ? "w" : "len"
    expect(lineOf(lined("", `<a:${end} type="triangle" ${attribute}="${size}"/>`))).toMatchObject({ [field]: size })
  })

  it("reads an arrow size that sits on a headEnd with no type", () => {
    expect(lineOf(lined("", '<a:tailEnd w="lg" len="sm"/>'))).toMatchObject({ tailWidth: "lg", tailLength: "sm" })
  })

  it("inherits each new line property from the master and the theme line", () => {
    const base = sp(lined('cap="rnd"', "<a:bevel/>"), ph())
    const styles = lined(
      'cmpd="dbl"',
      `${solid("FFFFFF")}<a:custDash><a:ds d="100000" sp="300000"/></a:custDash><a:tailEnd type="triangle" w="lg"/>`,
    )
    expect(
      own(partsOf(sp(lined("", ""), ph(), ref("ln", "1")), sp(lined("", ""), ph()), base, "", styles)).line,
    ).toEqual({
      ...line,
      fill: expected("FFFFFF"),
      cap: "rnd",
      compound: "dbl",
      join: { kind: "bevel" },
      dashes: [{ dash: 1, space: 3 }],
      tail: "triangle",
      tailWidth: "lg",
    })
  })

  it("keeps the shape's own cap and join before the theme's", () => {
    const styles = lined('cap="flat" cmpd="dbl"', "<a:round/>")
    const result = lineOf(lined('cap="sq"', "<a:miter/>"), "", "", styles, ref("ln", "1"))
    expect(result).toMatchObject({ cap: "sq", compound: "dbl", join: { kind: "miter" } })
  })

  it("takes a custom dash from the first level that sets any dash", () => {
    const shape = lined("", '<a:prstDash val="dash"/>')
    const styles = lined("", '<a:custDash><a:ds d="100000" sp="100000"/></a:custDash>')
    const result = lineOf(shape, "", "", styles, ref("ln", "1"))
    expect(result?.dash).toBe("dash")
    expect(result).not.toHaveProperty("dashes")
  })
})
