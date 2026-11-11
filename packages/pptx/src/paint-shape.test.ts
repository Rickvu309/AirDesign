import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"

const slide = "ppt/slides/slide1.xml"
const layout = "ppt/slideLayouts/layout.xml"
const master = "ppt/slideMasters/master.xml"
const theme = "ppt/theme/theme.xml"
const solid = (hex: string) => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`
const expected = (hex: string) => ({ type: "solid", color: { hex, alpha: 1 } })
const ph = (type = "title", index = "1") => `<p:ph type="${type}" idx="${index}"/>`
const sp = (properties = "", placeholder = "", style = "", id = "2", kind = "sp") => {
  const nv = kind === "pic" ? "Pic" : kind === "graphicFrame" ? "GraphicFrame" : kind === "cxnSp" ? "CxnSp" : "Sp"
  return `<p:${kind}><p:nv${nv}Pr><p:cNvPr id="${id}"/><p:nvPr>${placeholder}</p:nvPr></p:nv${nv}Pr><p:spPr>${properties}</p:spPr>${style}</p:${kind}>`
}
const group = (properties: string, inside: string, id = "3") =>
  `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}"/></p:nvGrpSpPr><p:grpSpPr>${properties}</p:grpSpPr>${inside}</p:grpSp>`
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
const elements = (parts: ReadonlyMap<string, Uint8Array>) => paintReader(parts).slide(slide).elements
const own = (parts: ReadonlyMap<string, Uint8Array>) => elements(parts).find((element) => element.from === "slide")!
const ln = (inside = "", width = "") => `<a:ln ${width === "" ? "" : `w="${width}"`}>${inside}</a:ln>`
const line = { fill: { type: "none" }, width: 9525, dash: null, head: null, tail: null }

describe("shape paint", () => {
  it.each([
    ["<a:noFill/>", { type: "none" }],
    [solid("123456"), expected("123456")],
    [
      '<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="123456"/></a:gs></a:gsLst><a:lin ang="5400000"/></a:gradFill>',
      { type: "gradient", stops: [{ position: 0, color: { hex: "123456", alpha: 1 } }], angle: 90 },
    ],
    [
      '<a:pattFill prst="pct5"><a:fgClr><a:srgbClr val="123456"/></a:fgClr><a:bgClr><a:srgbClr val="FFFFFF"/></a:bgClr></a:pattFill>',
      {
        type: "pattern",
        preset: "pct5",
        foreground: { hex: "123456", alpha: 1 },
        background: { hex: "FFFFFF", alpha: 1 },
      },
    ],
  ])("reads its own fill %s", (markup, fill) => {
    expect(own(partsOf(sp(String(markup)))).fill).toEqual(fill)
  })

  it("reads only direct fill children, not lines, runs or nested shapes", () => {
    const nested = `${ln(solid("FF0000"))}<a:rPr>${solid("00FF00")}</a:rPr><a:extLst>${sp(solid("0000FF"), "", "", "9")}</a:extLst>`
    expect(own(partsOf(sp(nested))).fill).toBeNull()
    expect(own(partsOf(sp(nested + solid("123456")))).fill).toEqual(expected("123456"))
  })

  it.each([
    [solid("111111"), solid("222222"), solid("333333"), "111111"],
    ["", solid("222222"), solid("333333"), "222222"],
    ["", "", solid("333333"), "333333"],
  ])("inherits fill in shape, layout, master order %s", (shapeFill, layoutFill, masterFill, hex) => {
    expect(own(partsOf(sp(shapeFill, ph()), sp(layoutFill, ph()), sp(masterFill, ph()))).fill).toEqual(expected(hex))
  })

  it("matches placeholder fills by layout index before type and uses the layout type on the master", () => {
    const shapes = sp("", ph("obj", "7"))
    const inherited = sp(solid("111111"), ph("obj", "9"), "", "8") + sp("", ph("ctrTitle", "7"))
    expect(own(partsOf(shapes, inherited, sp(solid("333333"), ph("title", "9")))).fill).toEqual(expected("333333"))
    expect(own(partsOf(sp("", ph("title", "20")), sp(solid("222222"), ph("title", "2")))).fill).toEqual(
      expected("222222"),
    )
  })

  it("keeps explicit noFill and malformed own fills from inheriting", () => {
    expect(own(partsOf(sp("<a:noFill/>", ph()), sp(solid("FFFFFF"), ph()))).fill).toEqual({ type: "none" })
    expect(own(partsOf(sp("<a:solidFill/>", ph()), sp(solid("FFFFFF"), ph()))).fill).toBeNull()
    expect(own(partsOf(sp(), sp(solid("FFFFFF"), ph()))).fill).toBeNull()
  })

  it("uses one-based fillRef entries and replaces phClr with the reference color", () => {
    const fill = '<a:solidFill><a:schemeClr val="phClr"><a:alphaMod val="50000"/></a:schemeClr></a:solidFill>'
    const parts = partsOf(sp("", "", ref("fill", "2")), "", "", solid("FFFFFF") + fill)
    expect(own(parts).fill).toEqual({ type: "solid", color: { hex: "336699", alpha: 0.5 } })
  })

  it.each(["0", "3", "-1", "bad"])("handles fillRef idx %s", (index) => {
    expect(own(partsOf(sp("", "", ref("fill", index)), "", "", solid("FFFFFF"))).fill).toEqual(
      index === "0" ? { type: "none" } : null,
    )
  })

  it("uses fillRef only after placeholder fills and inherits placeholder references", () => {
    expect(own(partsOf(sp("", ph(), ref("fill", "1")), sp(solid("222222"), ph()), "", solid("FFFFFF"))).fill).toEqual(
      expected("222222"),
    )
    expect(own(partsOf(sp("", ph()), sp("", ph(), ref("fill", "1")), "", solid("FFFFFF"))).fill).toEqual(
      expected("FFFFFF"),
    )
  })

  it("resolves nested grpFill from the direct parent group's resolved fill", () => {
    const shapes = group(solid("123456"), group("<a:grpFill/>", sp("<a:grpFill/>"), "4"))
    expect(elements(partsOf(shapes)).map((element) => element.fill)).toEqual([
      expected("123456"),
      expected("123456"),
      expected("123456"),
    ])
    expect(own(partsOf(sp("<a:grpFill/>"))).fill).toBeNull()
    expect(elements(partsOf(group("", sp(solid("FFFFFF")))))[0]?.fill).toBeNull()
  })

  it.each(["sp", "pic", "graphicFrame"])("reads properties and geometry for %s", (kind) => {
    const shape = own(
      partsOf(sp(`${solid("123456")}${ln("<a:noFill/>")}<a:prstGeom prst="ellipse"/>`, "", "", "2", kind)),
    )
    expect(shape.fill).toEqual(kind === "graphicFrame" ? null : expected("123456"))
    expect(shape.line).toEqual(kind === "graphicFrame" ? null : line)
    expect(shape.geometry).toBe(kind === "graphicFrame" ? null : "ellipse")
  })

  it.each([
    ["sp", '<a:prstGeom prst="ellipse"/>', '<a:prstGeom prst="rect"/>', "<a:custGeom/>", "ellipse"],
    ["sp", "", '<a:prstGeom prst="rect"/>', "<a:custGeom/>", "rect"],
    ["sp", "", "", "<a:custGeom/>", "custom"],
    ["pic", "", '<a:prstGeom prst="rect"/>', "", "rect"],
    ["pic", "", "", '<a:prstGeom prst="ellipse"/>', "ellipse"],
  ])("takes %s placeholder geometry %j first, then the layout's, then the master's", (kind, a, b, c, geometry) => {
    expect(own(partsOf(sp(a, ph(), "", "2", kind), sp(b, ph()), sp(c, ph()))).geometry).toBe(geometry)
  })

  it("keeps a direct noFill over a fillRef", () => {
    expect(own(partsOf(sp("<a:noFill/>", "", ref("fill", "1")), "", "", solid("FFFFFF"))).fill).toEqual({
      type: "none",
    })
  })

  it("keeps the lnRef color under a line that gives only a width", () => {
    const style = ln('<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>', "9525")
    expect(own(partsOf(sp(ln("", "25400"), "", ref("ln", "1")), "", "", "", style)).line).toEqual({
      ...line,
      fill: expected("336699"),
      width: 25400,
    })
  })

  it("reads a connector's fill, line and geometry", () => {
    const properties = `${solid("123456")}<a:prstGeom prst="straightConnector1"/>`
    const shape = own(
      partsOf(sp(properties, "", ref("ln", "1"), "2", "cxnSp"), "", "", "", ln(solid("2C567A"), "6350")),
    )
    expect([shape.fill, shape.line, shape.geometry]).toEqual([
      expected("123456"),
      { ...line, fill: expected("2C567A"), width: 6350 },
      "straightConnector1",
    ])
  })

  it("reports custom geometry without a path and absent geometry", () => {
    expect(own(partsOf(sp("<a:custGeom/>"))).geometry).toBe("custom")
    expect(own(partsOf(sp())).geometry).toBeNull()
  })

  it.each([0, 1, 2, 3])("resolves picture fills through the blip owner's relationships at level %s", (level) => {
    const fill = '<a:blipFill><a:blip r:embed="image"/></a:blipFill>'
    const shapes = ["", "", ""]
    if (level < 3) shapes[level] = fill
    const parts = partsOf(
      sp(shapes[0], ph(), level === 3 ? ref("fill", "1") : ""),
      sp(shapes[1], ph()),
      sp(shapes[2], ph()),
      level === 3 ? fill : "",
    )
    const relationship = [
      "ppt/slides/_rels/slide1.xml.rels",
      "ppt/slideLayouts/_rels/layout.xml.rels",
      "ppt/slideMasters/_rels/master.xml.rels",
      "ppt/theme/_rels/theme.xml.rels",
    ][level]!
    const existing = parts.get(relationship)
    const image = '<Relationship Id="image" Type="r/image" Target="../media/paint.png"/>'
    parts.set(
      relationship,
      encodeUtf8(
        existing === undefined
          ? `<Relationships>${image}</Relationships>`
          : decodeUtf8(existing).replace("</Relationships>", `${image}</Relationships>`),
      ),
    )
    parts.set("ppt/media/paint.png", new Uint8Array())
    expect(own(parts).fill).toEqual({ type: "picture", part: "ppt/media/paint.png" })
    parts.delete("ppt/media/paint.png")
    expect(own(parts).fill).toBeNull()
  })

  it("does not resolve external picture fills", () => {
    const parts = partsOf(sp('<a:blipFill><a:blip r:embed="image"/></a:blipFill>'))
    parts.set(
      "ppt/slides/_rels/slide1.xml.rels",
      encodeUtf8(
        '<Relationships><Relationship Id="image" Type="r/image" TargetMode="External" Target="https://example.com/image"/></Relationships>',
      ),
    )
    expect(own(parts).fill).toBeNull()
  })

  it("merges every line property across shape, layout, master and theme", () => {
    const shapes = sp(ln('<a:prstDash val="dot"/><a:headEnd type="none"/>', "100"), ph(), ref("ln", "2"))
    const inherited = sp(ln(`${solid("123456")}<a:prstDash val="dash"/><a:tailEnd type="triangle"/>`, "200"), ph())
    const base = sp(ln('<a:headEnd type="oval"/>', "300"), ph())
    const styles = ln(solid("FFFFFF"), "400") + ln('<a:noFill/><a:tailEnd type="diamond"/>', "500")
    expect(own(partsOf(shapes, inherited, base, "", styles)).line).toEqual({
      fill: expected("123456"),
      width: 100,
      dash: "dot",
      head: "none",
      tail: "triangle",
    })
  })

  it.each([
    ["100", "200", "300", "100"],
    ["", "200", "300", "200"],
    ["", "", "300", "300"],
    ["", "", "", "400"],
  ])("inherits line width property by property %s %s %s", (a, b, c, width) => {
    const parts = partsOf(
      sp(ln("", a), ph(), ref("ln", "1")),
      sp(ln("", b), ph()),
      sp(ln("", c), ph()),
      "",
      ln("", "400"),
    )
    expect(own(parts).line?.width).toBe(Number(width))
  })

  it("inherits master line properties before theme line properties", () => {
    const parts = partsOf(
      sp(ln(), ph(), ref("ln", "1")),
      sp(ln(), ph()),
      sp(ln(`${solid("123456")}<a:prstDash val="dash"/><a:headEnd type="oval"/><a:tailEnd type="arrow"/>`), ph()),
      "",
      ln(solid("FFFFFF")),
    )
    expect(own(parts).line).toEqual({ ...line, fill: expected("123456"), dash: "dash", head: "oval", tail: "arrow" })
  })

  it("keeps each own line property before the placeholder's properties", () => {
    const shapes = sp(
      ln(`${solid("123456")}<a:prstDash val="dot"/><a:headEnd type="none"/><a:tailEnd type="none"/>`, "100"),
      ph(),
    )
    const inherited = sp(
      ln(`${solid("FFFFFF")}<a:prstDash val="dash"/><a:headEnd type="oval"/><a:tailEnd type="triangle"/>`, "200"),
      ph(),
    )
    expect(own(partsOf(shapes, inherited)).line).toEqual({
      fill: expected("123456"),
      width: 100,
      dash: "dot",
      head: "none",
      tail: "none",
    })
  })

  it("resolves a theme-only lnRef with phClr and one-based indexing", () => {
    const style = ln(
      '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="sysDot"/><a:headEnd type="triangle"/><a:tailEnd type="oval"/>',
      "222",
    )
    expect(own(partsOf(sp("", "", ref("ln", "2")), "", "", "", ln("<a:noFill/>", "111") + style)).line).toEqual({
      fill: expected("336699"),
      width: 222,
      dash: "sysDot",
      head: "triangle",
      tail: "oval",
    })
  })

  it.each(["0", "2", "-1", "bad"])("handles lnRef idx %s without creating a line", (index) => {
    expect(own(partsOf(sp("", "", ref("ln", index)), "", "", "", ln(solid("FFFFFF")))).line).toBeNull()
  })

  it("keeps own lines with lnRef zero, noFill, zero width and the default width", () => {
    expect(
      own(
        partsOf(
          sp(ln("<a:noFill/>"), ph(), ref("ln", "1")),
          sp(ln(solid("FFFFFF")), ph()),
          "",
          "",
          ln(solid("FFFFFF")),
        ),
      ).line,
    ).toEqual(line)
    expect(
      own(partsOf(sp(ln("<a:noFill/>"), "", ref("ln", "0")), "", "", "", ln(solid("FFFFFF"), "200"))).line,
    ).toEqual(line)
    expect(own(partsOf(sp(ln("<a:noFill/>", "0")))).line).toEqual({ ...line, width: 0 })
    expect(own(partsOf(sp(ln("", "bad")))).line).toEqual(line)
    expect(own(partsOf(sp())).line).toBeNull()
  })

  it("does no eager reads and caches theme style lists across slides", () => {
    const parts = partsOf(sp("", "", ref("fill", "1")), "", "", solid("123456"))
    parts.set("ppt/slides/slide2.xml", parts.get(slide)!)
    parts.set("ppt/slides/_rels/slide2.xml.rels", parts.get("ppt/slides/_rels/slide1.xml.rels")!)
    let reads = 0
    const get = parts.get.bind(parts)
    parts.get = (part) => {
      reads += 1
      return get(part)
    }
    const reader = paintReader(parts)
    expect(reads).toBe(0)
    expect(reader.slide(slide).elements[0]?.fill).toEqual(expected("123456"))
    let themeReads = 0
    parts.get = (part) => {
      if (part === theme) themeReads += 1
      return get(part)
    }
    expect(reader.slide("ppt/slides/slide2.xml").elements[0]?.fill).toEqual(expected("123456"))
    expect(themeReads).toBe(0)
  })
})
