import { describe, expect, it, vi } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { markupDocument } from "./element-span.js"
import { markupChildren } from "./text-value-route.js"
import { paintFill } from "./paint-fill.js"
import { paintReader } from "./paint-reader.js"

const work = vi.hoisted(() => ({ types: 0 }))
vi.mock("./element-span.js", async (original) => {
  const real = await original<typeof import("./element-span.js")>()
  return {
    ...real,
    markupDocument: (bytes: Uint8Array) => {
      if (decodeUtf8(bytes).startsWith("<Types>")) work.types += 1
      return real.markupDocument(bytes)
    },
  }
})

const slide = "ppt/slides/slide1.xml"
const layout = "ppt/slideLayouts/layout.xml"
const master = "ppt/slideMasters/master.xml"
const media = "ppt/media/image.png"
const crop = { left: 0, top: 0, right: 0, bottom: 0 }
const image = { part: media, contentType: "image/png", crop, tile: false }
const blip = (inside = "", attributes = 'r:embed="image"') =>
  `<p:blipFill><a:blip ${attributes}/>${inside}</p:blipFill>`
const pic = (fill = blip(), placeholder = "") =>
  `<p:pic><p:nvPicPr><p:cNvPr id="2"/><p:nvPr>${placeholder}</p:nvPr></p:nvPicPr>${fill}</p:pic>`
const frame = (inside = "") =>
  `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="3"/></p:nvGraphicFramePr><a:graphic><a:graphicData>${inside}</a:graphicData></a:graphic></p:graphicFrame>`
const sheet = (kind: string, inside: string) => `<${kind}><p:cSld><p:spTree>${inside}</p:spTree></p:cSld></${kind}>`
const rel = (id: string, type: string, target: string, mode = "") =>
  `<Relationship Id="${id}" Type="r/${type}" Target="${target}" ${mode}/>`
const rels = (...items: string[]) => encodeUtf8(`<Relationships>${items.join("")}</Relationships>`)
const partsOf = (inside: string) =>
  new Map([
    [slide, encodeUtf8(sheet("p:sld", inside))],
    [layout, encodeUtf8(sheet("p:sldLayout", ""))],
    [master, encodeUtf8(sheet("p:sldMaster", ""))],
    [
      "ppt/slides/_rels/slide1.xml.rels",
      rels(rel("layout", "slideLayout", "../slideLayouts/layout.xml"), rel("image", "image", "../media/image.png")),
    ],
    [
      "ppt/slideLayouts/_rels/layout.xml.rels",
      rels(rel("master", "slideMaster", "../slideMasters/master.xml"), rel("image", "image", "../media/layout.png")),
    ],
    ["ppt/slideMasters/_rels/master.xml.rels", rels(rel("image", "image", "../media/master.png"))],
    [media, new Uint8Array()],
    ["ppt/media/layout.png", new Uint8Array()],
    ["ppt/media/master.png", new Uint8Array()],
    ["[Content_Types].xml", encodeUtf8('<Types><Default Extension="png" ContentType="image/png"/></Types>')],
  ])
const images = (parts: ReadonlyMap<string, Uint8Array>) =>
  paintReader(parts)
    .slide(slide)
    .elements.map((element) => element.image)

describe("paint pictures", () => {
  it("keeps all paint fields on slide, layout and master elements", () => {
    const parts = partsOf(pic())
    parts.set(layout, encodeUtf8(sheet("p:sldLayout", pic())))
    parts.set(master, encodeUtf8(sheet("p:sldMaster", pic())))
    const reader = paintReader(parts)
    for (let call = 0; call < 2; call += 1) {
      const elements = reader.slide(slide).elements
      expect(elements.map((element) => element.from)).toEqual(["master", "layout", "slide"])
      for (const element of elements) {
        expect(element).toMatchObject({ text: null, fill: null, line: null, geometry: null })
        expect(element.image?.contentType).toBe("image/png")
      }
    }
  })

  it("resolves embeds through the slide, layout and master relationships", () => {
    const parts = partsOf(pic())
    parts.set(layout, encodeUtf8(sheet("p:sldLayout", pic())))
    parts.set(master, encodeUtf8(sheet("p:sldMaster", pic())))
    expect(images(parts)).toEqual([
      { ...image, part: "ppt/media/master.png" },
      { ...image, part: "ppt/media/layout.png" },
      image,
    ])
  })

  it("does not follow links, external embeds, missing relationships or missing media", () => {
    expect(images(partsOf(pic(blip("", 'r:link="image"'))))).toEqual([null])
    const parts = partsOf(pic())
    parts.set(
      "ppt/slides/_rels/slide1.xml.rels",
      rels(rel("image", "image", "../media/image.png", 'TargetMode="External"')),
    )
    expect(images(parts)).toEqual([null])
    parts.delete("ppt/slides/_rels/slide1.xml.rels")
    expect(images(parts)).toEqual([null])
    const missing = partsOf(pic())
    missing.delete(media)
    expect(images(missing)).toEqual([null])
    expect(images(partsOf(pic("")))).toEqual([null])
  })

  it.each([
    ["l", "left"],
    ["t", "top"],
    ["r", "right"],
    ["b", "bottom"],
  ])("reads the %s crop side including negative values", (attribute, side) => {
    for (const value of [25000, -25000]) {
      expect(images(partsOf(pic(blip(`<a:srcRect ${attribute}="${value}"/>`))))).toEqual([
        { ...image, crop: { ...crop, [side]: value / 100000 } },
      ])
    }
  })

  it("defaults missing and malformed crop sides to zero and reads tile presence", () => {
    expect(images(partsOf(pic(blip('<a:srcRect l="bad" t="1e3" r="99999999999999999999"/><a:tile/>'))))).toEqual([
      { ...image, tile: true },
    ])
    expect(images(partsOf(pic()))).toEqual([image])
  })

  it("prefers Override to Default and reports unknown content types as null", () => {
    const parts = partsOf(pic())
    parts.set(
      "[Content_Types].xml",
      encodeUtf8(
        `<Types><Override PartName="/${media}" ContentType="image/override"/><Default Extension="png" ContentType="image/png"/></Types>`,
      ),
    )
    expect(images(parts)).toEqual([{ ...image, contentType: "image/override" }])
    parts.set("[Content_Types].xml", encodeUtf8("<Types/>"))
    expect(images(parts)).toEqual([{ ...image, contentType: null }])
    parts.delete("[Content_Types].xml")
    expect(images(parts)).toEqual([{ ...image, contentType: null }])
  })

  it("reads content types once on first image, never when constructing or painting plain shapes", () => {
    const parts = partsOf("")
    work.types = 0
    const reader = paintReader(parts)
    expect(work.types).toBe(0)
    reader.slide(slide)
    expect(work.types).toBe(0)
    parts.set(slide, encodeUtf8(sheet("p:sld", pic() + pic())))
    reader.slide(slide)
    reader.slide(slide)
    expect(work.types).toBe(1)
  })

  it("uses an AlternateContent fallback picture without adding another element", () => {
    const inside = `<mc:AlternateContent><mc:Choice>${frame()}</mc:Choice><mc:Fallback>${pic(blip('<a:srcRect l="25000"/><a:tile/>'))}</mc:Fallback></mc:AlternateContent>`
    expect(images(partsOf(inside))).toEqual([{ ...image, crop: { ...crop, left: 0.25 }, tile: true }])
    expect(images(partsOf(frame()))).toEqual([null])
  })

  it("uses the OLE picture inside graphicData", () => {
    expect(images(partsOf(frame(`<p:oleObj>${pic()}</p:oleObj>`)))).toEqual([image])
  })

  it("keeps a slide placeholder image and never inherits a layout image", () => {
    const parts = partsOf(pic(blip(), '<p:ph type="pic" idx="1"/>'))
    parts.set(layout, encodeUtf8(sheet("p:sldLayout", pic(blip(), '<p:ph type="pic" idx="1"/>'))))
    expect(images(parts)).toEqual([image])
    parts.set(slide, encodeUtf8(sheet("p:sld", pic("", '<p:ph type="pic" idx="1"/>'))))
    expect(images(parts)).toEqual([null])
  })

  it("reports picture shape fills through fill, not image", () => {
    const fill = '<a:blipFill><a:blip r:embed="image"/><a:srcRect l="25000" b="-5000"/><a:tile/></a:blipFill>'
    const shape = `<p:sp><p:nvSpPr><p:cNvPr id="4"/></p:nvSpPr><p:spPr>${fill}</p:spPr></p:sp>`
    expect(images(partsOf(shape))).toEqual([null])
    const { elements } = markupDocument(encodeUtf8(`<p:spPr>${fill}</p:spPr>`))
    expect(
      paintFill(
        elements[0]!,
        markupChildren(elements),
        { children: [], slots: new Map(), mapping: new Map(), placeholder: null },
        () => ({ part: media, contentType: "image/png" }),
      ),
    ).toEqual({
      type: "picture",
      ...image,
      crop: { ...crop, left: 0.25, bottom: -0.05 },
      tile: true,
    })
  })
})
