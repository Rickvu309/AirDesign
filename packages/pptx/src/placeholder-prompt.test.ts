import { describe, expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"

const relationship = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const slidePart = "ppt/slides/slide1.xml"
const layoutPart = "ppt/slideLayouts/slideLayout1.xml"
const masterPart = "ppt/slideMasters/slideMaster1.xml"
const xml = (text: string) => encodeUtf8(text)

const sheet = (root: string, shapes: string) =>
  `<${root}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld></${root}>`

const rels = (items: readonly [string, string][]) =>
  `<Relationships>${items.map(([target, type], index) => `<Relationship Id="rId${index + 1}" Type="${relationship}/${type}" Target="${target}"/>`).join("")}</Relationships>`

const shape = (id: string, ph: string, text = "") => {
  const body =
    text === "" ? "" : `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody>`
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s"/><p:cNvSpPr/><p:nvPr><p:ph ${ph}/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>${body}</p:sp>`
}

function deck(slideShapes: string, layoutShapes: string, masterShapes = ""): ReadonlyMap<string, Uint8Array> {
  return new Map<string, Uint8Array>([
    ["ppt/presentation.xml", xml(`<p:presentation><p:sldSz cx="100" cy="100"/></p:presentation>`)],
    [slidePart, xml(sheet("p:sld", slideShapes))],
    ["ppt/slides/_rels/slide1.xml.rels", xml(rels([["../slideLayouts/slideLayout1.xml", "slideLayout"]]))],
    [layoutPart, xml(sheet("p:sldLayout", layoutShapes))],
    ["ppt/slideLayouts/_rels/slideLayout1.xml.rels", xml(rels([["../slideMasters/slideMaster1.xml", "slideMaster"]]))],
    [masterPart, xml(sheet("p:sldMaster", masterShapes))],
  ])
}

const fallback = (type: string | null | undefined) => {
  if (type === "title" || type === "ctrTitle") return "Add a title"
  if (type === "subTitle") return "Add a subtitle"
  return "Add text"
}

describe("placeholderPrompt in paintReader", () => {
  it("carries layout prompt when a slide placeholder has no text", () => {
    const parts = deck(shape("2", `type="title"`), shape("10", `type="title"`, "Add project title"))
    const slide = paintReader(parts).slide(slidePart)
    expect(slide.elements[0]?.prompt).toBe("Add project title")
  })

  it("falls back to standard table prompt when layout has no prompt and master has boilerplate", () => {
    const parts = deck(
      shape("2", `type="title"`),
      shape("10", `type="title"`),
      shape("20", `type="title"`, "Click to edit Master title style"),
    )
    const slide = paintReader(parts, { fallbackPrompt: fallback }).slide(slidePart)
    expect(slide.elements[0]?.prompt).toBe("Add a title")
  })

  it("falls back to standard table prompt when placeholder comes from master without layout shape", () => {
    const parts = deck(
      shape("2", `type="subTitle"`),
      "",
      shape("20", `type="subTitle"`, "Click to edit Master subtitle style"),
    )
    const slide = paintReader(parts, { fallbackPrompt: fallback }).slide(slidePart)
    expect(slide.elements[0]?.prompt).toBe("Add a subtitle")
  })

  it("sets prompt to null when slide placeholder has text of its own", () => {
    const parts = deck(shape("2", `type="title"`, "Real title"), shape("10", `type="title"`, "Add project title"))
    const slide = paintReader(parts, { fallbackPrompt: fallback }).slide(slidePart)
    expect(slide.elements[0]?.prompt).toBeNull()
  })

  it("uses standard prompts for body and ctrTitle placeholders", () => {
    const bodyDeck = deck(shape("2", `type="obj"`), shape("10", `type="obj"`))
    expect(paintReader(bodyDeck, { fallbackPrompt: fallback }).slide(slidePart).elements[0]?.prompt).toBe("Add text")

    const ctrDeck = deck(shape("2", `type="ctrTitle"`), shape("10", `type="ctrTitle"`))
    expect(paintReader(ctrDeck, { fallbackPrompt: fallback }).slide(slidePart).elements[0]?.prompt).toBe("Add a title")
  })

  it("gives no prompt to a placeholder that holds a picture, chart or table, not typed text", () => {
    for (const type of ["pic", "chart", "tbl", "media", "dgm", "clipArt"]) {
      const withLayoutText = deck(
        shape("2", `type="${type}"`),
        shape("10", `type="${type}"`, "Click icon to add content"),
      )
      expect(paintReader(withLayoutText, { fallbackPrompt: fallback }).slide(slidePart).elements[0]?.prompt).toBeNull()
      const bare = deck(shape("2", `type="${type}"`), shape("10", `type="${type}"`))
      expect(paintReader(bare, { fallbackPrompt: fallback }).slide(slidePart).elements[0]?.prompt).toBeNull()
    }
  })
})
