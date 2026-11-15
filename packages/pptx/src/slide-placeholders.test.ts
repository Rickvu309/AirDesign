declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
import { nextSlideId, orderKeyAfter, presentSlides, slideId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { slideAddresses } from "./package-address.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { paintReader } from "./paint-reader.js"
import { withLayoutPlaceholders } from "./slide-placeholders.js"
import { orderedParts } from "./slide-order-route.js"
import { applyRoute } from "./slide-route.js"

const xml = (value: string) => encodeUtf8(value)
const slidePart = "ppt/slides/slide1.xml"
const layoutPart = "ppt/slideLayouts/slideLayout1.xml"

const sheet = (root: string, shapes: string) =>
  `<${root}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld></${root}>`

describe("withLayoutPlaceholders", () => {
  it("paints a blank slide with the layout placeholder's box", () => {
    const layout = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title" idx="0"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="10" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:spPr></p:sp>`
    const parts = new Map<string, Uint8Array>([
      ["ppt/presentation.xml", xml(`<p:presentation><p:sldSz cx="100" cy="100"/></p:presentation>`)],
      [slidePart, xml(sheet("p:sld", ""))],
      [
        "ppt/slides/_rels/slide1.xml.rels",
        xml(
          `<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`,
        ),
      ],
      [layoutPart, xml(sheet("p:sldLayout", layout))],
    ])
    const painted = paintReader(withLayoutPlaceholders(parts, slidePart, layoutPart)).slide(slidePart).elements
    const box = painted.find((element) => element.placeholder?.type === "title")?.box
    expect(box).toMatchObject({ x: 10, y: 20, width: 30, height: 40 })
  })

  it("gives a text placeholder an empty text body that takes typed text, and a picture placeholder none", () => {
    const title = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>`
    const picture = `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Picture"/><p:cNvSpPr/><p:nvPr><p:ph type="pic" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>`
    const parts = new Map<string, Uint8Array>([
      [slidePart, xml(sheet("p:sld", ""))],
      [layoutPart, xml(sheet("p:sldLayout", title + picture))],
    ])
    const placed = withLayoutPlaceholders(parts, slidePart, layoutPart)
    const written = decodeUtf8(placed.get(slidePart) ?? new Uint8Array())
    expect(written).toContain(
      `<p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`,
    )
    expect(written).toContain(`<p:ph type="pic" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>`)
    const typed = applyRoute(placed, {
      name: "text",
      part: slidePart,
      shape: "2",
      value: [{ from: 0, runs: [{ from: -1, text: "Typed" }] }],
    })
    expect(decodeUtf8(typed.get(slidePart) ?? new Uint8Array())).toContain("<a:p><a:r><a:t>Typed</a:t></a:r></a:p>")
  })

  it("copies the layout text frame so a typed title keeps its size and alignment", () => {
    const title = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="ctrTitle" idx="0"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"><a:defRPr sz="4400"/></a:pPr><a:r><a:t>Prompt</a:t></a:r><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`
    const parts = new Map<string, Uint8Array>([
      ["ppt/presentation.xml", xml(`<p:presentation><p:sldSz cx="100" cy="100"/></p:presentation>`)],
      [slidePart, xml(sheet("p:sld", ""))],
      [layoutPart, xml(sheet("p:sldLayout", title))],
    ])
    const placed = withLayoutPlaceholders(parts, slidePart, layoutPart)
    const written = decodeUtf8(placed.get(slidePart) ?? new Uint8Array())
    expect(written).toContain(`<a:bodyPr anchor="ctr"/>`)
    expect(written).toContain(`<a:pPr algn="ctr"><a:defRPr sz="4400"/></a:pPr>`)
    expect(written).not.toContain("Prompt")
    const typed = applyRoute(placed, {
      name: "text",
      part: slidePart,
      shape: "2",
      value: [{ from: 0, runs: [{ from: -1, text: "Typed" }] }],
    })
    const after = decodeUtf8(typed.get(slidePart) ?? new Uint8Array())
    expect(after).toContain(`<a:pPr algn="ctr"><a:defRPr sz="4400"/></a:pPr>`)
    expect(after).toContain("<a:t>Typed</a:t>")
    const text = paintReader(typed)
      .slide(slidePart)
      .elements.find((element) => element.placeholder?.type === "ctrTitle")?.text
    expect(text?.anchor).toBe("middle")
    expect(text?.paragraphs[0]).toMatchObject({ align: "center", endStyle: { size: 44 } })
  })
})

const fixtures = `${process.cwd()}/scripts/pptx-fixtures`

const prompts = (type: string | null | undefined) => {
  if (type === "title" || type === "ctrTitle") return "Click to add title"
  if (type === "subTitle") return "Click to add subtitle"
  return "Click to add text"
}

async function newSlide(deck: string, layout: string) {
  const original = await readParts(readFileSync(`${fixtures}/${deck}`))
  const file = slideAddresses(original).map((address) => slideId(address.slide))
  const first = file[0]
  if (first === undefined) throw new Error("slide")
  const key = orderKeyAfter(presentSlides({ file, order: [] }), first)
  if (key === null) throw new Error("key")
  const id = nextSlideId(file)
  const parts = orderedParts(original, {
    file,
    order: [{ slide: "add", id, after: first, key, layout: first, layoutPart: layout }],
  })
  const part = slideAddresses(parts)[1]?.part
  if (part === undefined) throw new Error("slide")
  return { parts, part, xml: decodeUtf8(parts.get(part) ?? new Uint8Array()) }
}

const types = (xml: string) => [...xml.matchAll(/<p:ph(?: type="(\w+)")?/g)].map((found) => found[1] ?? "obj")

describe("a new slide from a deck's layout", () => {
  it("starts Title and Content with one empty first-level paragraph and PowerPoint's prompts", async () => {
    const { parts, part, xml } = await newSlide("doe-heat-pumps.pptx", "ppt/slideLayouts/slideLayout2.xml")
    expect(types(xml)).toEqual(["title", "obj"])
    expect(xml).not.toContain("Click to edit Master")
    expect(xml).not.toMatch(/lvl="[1-8]"/)
    expect(xml.match(/<a:p[ >/]/g)).toHaveLength(2)
    const elements = paintReader(parts, { fallbackPrompt: prompts }).slide(part).elements
    expect(elements.map((element) => element.prompt)).toEqual(["Click to add title", "Click to add text"])
    expect(elements.map((element) => element.text?.paragraphs.length)).toEqual([1, 1])
  })

  it("adds the footer boxes the slide master shows, with the slide's own number", async () => {
    const { xml } = await newSlide("corpus/nasa-cots-parts-nesc.pptx", "ppt/slideLayouts/slideLayout2.xml")
    expect(types(xml)).toEqual(["title", "obj", "dt", "ftr", "sldNum"])
    expect(xml).toMatch(/<a:fld [^>]*type="slidenum"><a:rPr[^>]*\/><a:t>2<\/a:t><\/a:fld>/)
  })

  it("leaves out a footer box the slide master's header and footer settings turn off", async () => {
    const { xml } = await newSlide("corpus/nasa-class-d-mar.pptx", "ppt/slideLayouts/slideLayout1.xml")
    expect(types(xml)).toEqual(["obj", "title"])
  })
})
