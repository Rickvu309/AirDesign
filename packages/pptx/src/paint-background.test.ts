import { describe, expect, it, vi } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"

const work = vi.hoisted(() => ({ parses: 0 }))
vi.mock("./element-span.js", async (original) => {
  const real = await original<typeof import("./element-span.js")>()
  return {
    ...real,
    markupDocument: (bytes: Uint8Array) => {
      work.parses += 1
      return real.markupDocument(bytes)
    },
  }
})
const slide = "ppt/slides/slide1.xml"
const layout = "ppt/slideLayouts/layout.xml"
const master = "ppt/slideMasters/master.xml"
const theme = "ppt/theme/theme.xml"
const solid = (hex: string) => `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${hex}"/></a:solidFill></p:bgPr></p:bg>`
const scheme = (name: string) => `<p:bg><p:bgPr><a:solidFill><a:schemeClr val="${name}"/></a:solidFill></p:bgPr></p:bg>`
const rels = (type: string, target: string, id = "r1") =>
  `<Relationships><Relationship Id="${id}" Type="r/${type}" Target="${target}"/></Relationships>`
const partsOf = (backgrounds: readonly string[] = [], overrides: readonly string[] = [], styles = "") =>
  new Map([
    [slide, encodeUtf8(`<p:sld><p:cSld>${backgrounds[0] ?? ""}</p:cSld>${overrides[0] ?? ""}</p:sld>`)],
    [layout, encodeUtf8(`<p:sldLayout><p:cSld>${backgrounds[1] ?? ""}</p:cSld>${overrides[1] ?? ""}</p:sldLayout>`)],
    [
      master,
      encodeUtf8(
        `<p:sldMaster><p:cSld>${backgrounds[2] ?? ""}</p:cSld><p:clrMap bg1="lt1" tx1="dk1"/>${overrides[2] ?? ""}</p:sldMaster>`,
      ),
    ],
    [
      theme,
      encodeUtf8(
        `<a:theme><a:themeElements><a:clrScheme><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk1><a:sysClr lastClr="000000"/></a:dk1><a:accent1><a:srgbClr val="FF0000"/></a:accent1></a:clrScheme><a:fmtScheme><a:bgFillStyleLst>${styles}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`,
      ),
    ],
    ["ppt/slides/_rels/slide1.xml.rels", encodeUtf8(rels("slideLayout", "../slideLayouts/layout.xml"))],
    ["ppt/slideLayouts/_rels/layout.xml.rels", encodeUtf8(rels("slideMaster", "../slideMasters/master.xml"))],
    ["ppt/slideMasters/_rels/master.xml.rels", encodeUtf8(rels("theme", "../theme/theme.xml"))],
  ])
const background = (parts: ReadonlyMap<string, Uint8Array>) => paintReader(parts).slide(slide).background
const expected = (hex: string) => ({ type: "solid", color: { hex, alpha: 1 } })
const override = (slot: string) => `<p:clrMapOvr><a:overrideClrMapping bg1="${slot}" accent1="dk1"/></p:clrMapOvr>`

describe("paint backgrounds", () => {
  it.each([
    [[solid("123456"), solid("234567"), solid("345678")], "123456"],
    [["", solid("234567"), solid("345678")], "234567"],
    [["", "", solid("345678")], "345678"],
  ])("inherits the nearest background %j", (levels, hex) => expect(background(partsOf(levels))).toEqual(expected(hex)))

  it("keeps noFill distinct from absence and never falls through an invalid background", () => {
    expect(background(partsOf())).toBeNull()
    expect(background(partsOf(["<p:bg><p:bgPr><a:noFill/></p:bgPr></p:bg>", "", solid("FFFFFF")]))).toEqual({
      type: "none",
    })
    expect(background(partsOf(["<p:bg/>", "", solid("FFFFFF")]))).toBeNull()
  })

  it("maps master aliases, then replaces the map at each level", () => {
    expect(background(partsOf([scheme("bg1")]))).toEqual(expected("FFFFFF"))
    expect(background(partsOf([scheme("bg1")], ["", override("dk1")]))).toEqual(expected("000000"))
    expect(background(partsOf([scheme("bg1")], [override("accent1"), override("dk1")]))).toEqual(expected("FF0000"))
    expect(
      background(partsOf([scheme("bg1")], ["<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>", override("dk1")])),
    ).toEqual(expected("000000"))
    expect(background(partsOf([scheme("tx1")], [override("accent1")]))).toBeNull()
    expect(background(partsOf([scheme("accent1")], [override("dk1")]))).toEqual(expected("000000"))
  })

  it("uses only the theme related to this master", () => {
    const parts = partsOf([scheme("accent1")])
    parts.set("ppt/theme/theme0.xml", encodeUtf8("<a:theme/>"))
    expect(background(parts)).toEqual(expected("FF0000"))
    parts.delete(theme)
    expect(background(parts)).toBeNull()
  })

  it("resolves phClr gradient stops in a bgRef style with the reference color", () => {
    const reference = '<p:bg><p:bgRef idx="1001"><a:srgbClr val="336699"/></p:bgRef></p:bg>'
    const style =
      '<a:gradFill><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"/></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:alpha val="50000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000"/></a:gradFill>'
    expect(background(partsOf([reference], [], style))).toEqual({
      type: "gradient",
      stops: [
        { position: 0, color: { hex: "336699", alpha: 1 } },
        { position: 1, color: { hex: "336699", alpha: 0.5 } },
      ],
      angle: 90,
    })
  })

  const styles = '<a:solidFill><a:srgbClr val="123456"/></a:solidFill><a:noFill/>'

  it("gives a null background for bgRef idx 0", () => {
    const reference = '<p:bg><p:bgRef idx="0"><a:srgbClr val="FFFFFF"/></p:bgRef></p:bg>'
    expect(background(partsOf([reference], [], styles))).toBeNull()
  })

  it("gives a null background for a bgRef idx past the style list", () => {
    const reference = '<p:bg><p:bgRef idx="1003"><a:srgbClr val="FFFFFF"/></p:bgRef></p:bg>'
    expect(background(partsOf([reference], [], styles))).toBeNull()
  })

  it("resolves bgRef 1001 with phClr and both sets of transforms", () => {
    const reference =
      '<p:bg><p:bgRef idx="1001"><a:schemeClr val="accent1"><a:alpha val="50000"/></a:schemeClr></p:bgRef></p:bg>'
    const style =
      '<a:solidFill><a:schemeClr val="phClr"><a:shade val="50000"/><a:alphaMod val="50000"/></a:schemeClr></a:solidFill>'
    expect(background(partsOf([reference], [], style))).toEqual({
      type: "solid",
      color: { hex: "BC0000", alpha: 0.25 },
    })
    expect(background(partsOf([reference.replace("1001", "1000")], [], style))).toBeNull()
    expect(background(partsOf([reference.replace("1001", "1002")], [], style + "<a:noFill/>"))).toEqual({
      type: "none",
    })
  })

  it("reads linear and path gradients and patterns", () => {
    const stops =
      '<a:gsLst><a:gs pos="0"><a:srgbClr val="FF0000"/></a:gs><a:gs pos="100000"><a:srgbClr val="0000FF"/></a:gs></a:gsLst>'
    const fill = (inside: string) => `<p:bg><p:bgPr>${inside}</p:bgPr></p:bg>`
    const expectedStops = [
      { position: 0, color: { hex: "FF0000", alpha: 1 } },
      { position: 1, color: { hex: "0000FF", alpha: 1 } },
    ]
    expect(background(partsOf([fill(`<a:gradFill>${stops}<a:lin ang="5400000"/></a:gradFill>`)]))).toEqual({
      type: "gradient",
      stops: expectedStops,
      angle: 90,
    })
    expect(background(partsOf([fill(`<a:gradFill>${stops}<a:path path="circle"/></a:gradFill>`)]))).toEqual({
      type: "gradient",
      stops: expectedStops,
      angle: null,
    })
    expect(
      background(
        partsOf([
          fill(
            '<a:pattFill prst="pct5"><a:fgClr><a:srgbClr val="FF0000"/></a:fgClr><a:bgClr><a:schemeClr val="bg1"/></a:bgClr></a:pattFill>',
          ),
        ]),
      ),
    ).toEqual({
      type: "pattern",
      preset: "pct5",
      foreground: { hex: "FF0000", alpha: 1 },
      background: { hex: "FFFFFF", alpha: 1 },
    })
  })

  it.each([0, 1, 2, 3])("resolves pictures using their owning part at level %s", (level) => {
    const fill = '<a:blipFill><a:blip r:embed="image"/><a:srcRect l="25000" b="-5000"/><a:tile/></a:blipFill>'
    const levels = ["", "", ""]
    if (level < 3) levels[level] = `<p:bg><p:bgPr>${fill}</p:bgPr></p:bg>`
    else levels[0] = '<p:bg><p:bgRef idx="1001"><a:srgbClr val="FFFFFF"/></p:bgRef></p:bg>'
    const parts = partsOf(levels, [], fill)
    const relationship = [
      "ppt/slides/_rels/slide1.xml.rels",
      "ppt/slideLayouts/_rels/layout.xml.rels",
      "ppt/slideMasters/_rels/master.xml.rels",
      "ppt/theme/_rels/theme.xml.rels",
    ][level]!
    const existing = parts.get(relationship)
    const image = '<Relationship Id="image" Type="r/image" Target="../media/picture.png"/>'
    parts.set(
      relationship,
      encodeUtf8(
        existing === undefined
          ? `<Relationships>${image}</Relationships>`
          : decodeUtf8(existing).replace("</Relationships>", `${image}</Relationships>`),
      ),
    )
    parts.set("ppt/media/picture.png", new Uint8Array())
    parts.set("[Content_Types].xml", encodeUtf8('<Types><Default Extension="png" ContentType="image/png"/></Types>'))
    expect(background(parts)).toEqual({
      type: "picture",
      part: "ppt/media/picture.png",
      contentType: "image/png",
      crop: { left: 0.25, top: 0, right: 0, bottom: -0.05 },
      tile: true,
    })
    parts.delete("ppt/media/picture.png")
    expect(background(parts)).toBeNull()
  })

  it("does not follow external pictures", () => {
    const parts = partsOf(['<p:bg><p:bgPr><a:blipFill><a:blip r:embed="image"/></a:blipFill></p:bgPr></p:bg>'])
    parts.set(
      "ppt/slides/_rels/slide1.xml.rels",
      encodeUtf8(
        '<Relationships><Relationship Id="image" Type="r/image" Target="https://example.com/image" TargetMode="External"/></Relationships>',
      ),
    )
    expect(background(parts)).toBeNull()
  })

  it("caches layouts, masters, themes and relationships without eager reads", () => {
    const parts = partsOf([scheme("bg1")])
    parts.set("ppt/slides/slide2.xml", parts.get(slide)!)
    parts.set("ppt/slides/_rels/slide2.xml.rels", parts.get("ppt/slides/_rels/slide1.xml.rels")!)
    work.parses = 0
    const reader = paintReader(parts)
    expect(work.parses).toBe(0)
    expect(reader.slide(slide).background).toEqual(expected("FFFFFF"))
    expect(work.parses).toBe(7)
    work.parses = 0
    expect(reader.slide("ppt/slides/slide2.xml").background).toEqual(expected("FFFFFF"))
    expect(work.parses).toBe(2)
  })
})
