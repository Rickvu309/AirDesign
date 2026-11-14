import type { FieldEdit } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { fillKinds } from "./color-read.js"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { shownFill, type Fill } from "./fill-read.js"
import { readPackage } from "./index.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { routeRuns } from "./route-parts.js"
import { fillMarkup } from "./trait-xml-fill.js"
import { writeTrait } from "./trait-xml.js"

type Parts = ReadonlyMap<string, Uint8Array>

const part = "ppt/slides/slide1.xml"
const rels = "ppt/slides/_rels/slide1.xml.rels"
const blue: Fill = { solid: { rgb: "19A7E8" } }
const solid = '<a:solidFill><a:srgbClr val="19A7E8"/></a:solidFill>'
const beforeGeometry = '<a:xfrm/><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
const afterGeometry = "<a:ln><a:noFill/></a:ln><a:effectLst/><a:scene3d/><a:sp3d/><a:extLst/>"
const style = '<p:style><a:fillRef idx="2"><a:schemeClr val="accent2"/></a:fillRef></p:style>'
const gradient: Fill = {
  gradient: {
    stops: [
      { pos: 0, color: { scheme: "accent1" } },
      { pos: 100_000, color: { scheme: "accent1", transforms: [{ op: "lumMod", val: 50_000 }] } },
    ],
    shade: { linear: { angle: 5_400_000, scaled: true } },
    rotateWithShape: true,
  },
}
const radial: Fill = {
  gradient: {
    stops: [
      { pos: 0, color: { rgb: "FFFFFF" } },
      { pos: 40_000, color: { scheme: "bg1" } },
      { pos: 100_000, color: { rgb: "000000" } },
    ],
    shade: { path: { kind: "circle", focus: { l: 50_000, t: 50_000, r: 50_000, b: 50_000 } } },
    rotateWithShape: false,
  },
}
const pattern: Fill = { pattern: { preset: "dkDnDiag", fg: { scheme: "accent2" }, bg: { scheme: "bg1" } } }

function slide(properties: string, kind = "p:sp", extra = ""): string {
  return `<?xml version="1.0"?><p:sld><p:cSld><p:spTree><${kind}><p:nvSpPr><p:cNvPr id="2" name="日本語 &amp; café"/></p:nvSpPr>${properties}${style}${extra}</${kind}><p:sp><p:cNvPr id="3"/><p:spPr><a:gradFill/></p:spPr></p:sp></p:spTree></p:cSld></p:sld>`
}

function parts(xml: string, name = part): Map<string, Uint8Array> {
  return new Map([
    [name, encodeUtf8(xml)],
    [rels, encodeUtf8('<Relationships><Relationship Id="rId2" Target="../media/image1.png"/></Relationships>')],
    ["ppt/media/image1.png", new Uint8Array([0, 255, 20])],
  ])
}

function edit(xml: string, value: FieldEdit<Fill>, name = part): string {
  const before = parts(xml, name)
  const snapshot = new Map([...before].map(([name, bytes]) => [name, bytes.slice()]))
  const next = writeTrait(before, { slide: "256", part: name, shape: "2" }, "fill", { value })
  expect(before).toEqual(snapshot)
  for (const [other, bytes] of before) if (other !== name) expect(next.get(other)).toBe(bytes)
  const bytes = next.get(name)
  if (bytes === undefined) throw new Error("part")
  expect(markupDocument(bytes).wellFormed).toBe(true)
  return decodeUtf8(bytes)
}

function write(xml: string, value: Fill = blue, name = part): string {
  return edit(xml, { set: value }, name)
}

function refuses(xml: string, error: string) {
  const before = parts(xml)
  expect(() => writeTrait(before, { slide: "256", part, shape: "2" }, "fill", { value: { set: blue } })).toThrow(error)
}

function cut(bytes: Uint8Array, element: MarkupElement | undefined): string {
  if (element === undefined) return decodeUtf8(bytes)
  return decodeUtf8(bytes.subarray(0, element.start)) + decodeUtf8(bytes.subarray(element.end))
}

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

async function deck(name: string): Promise<Parts> {
  const fs = process.getBuiltinModule("node:fs")
  const read = await readPackage(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))
  if (!read.ok) throw new Error(read.reason)
  return read.parts
}

describe("the fill codec writes the shape's one fill choice", () => {
  it.each(["", beforeGeometry, "<a:custGeom/>"])("inserts an absent fill in schema order after %s", (geometry) => {
    const xml = slide(`<p:spPr bwMode='auto'>${geometry} \n${afterGeometry}</p:spPr>`)
    expect(write(xml)).toBe(xml.replace(`${geometry} \n`, `${geometry}${solid} \n`))
  })

  it("expands self-closing properties without losing attributes or the style", () => {
    const xml = slide("<p:spPr bwMode='auto' />")
    expect(write(xml)).toBe(xml.replace("<p:spPr bwMode='auto' />", `<p:spPr bwMode='auto' >${solid}</p:spPr>`))
  })

  it.each([
    "<a:noFill/>",
    '<a:solidFill><a:schemeClr val="accent1"><a:lumMod val="50000"/><a:alpha val="75000"/></a:schemeClr></a:solidFill>',
    '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="FFFFFF"/></a:gs></a:gsLst><a:lin ang="0"/></a:gradFill>',
    '<a:pattFill prst="pct5"><a:fgClr><a:srgbClr val="FFFFFF"/></a:fgClr></a:pattFill>',
    "<a:grpFill/>",
    '<a:blipFill><a:blip r:embed="rId2"/><a:stretch/></a:blipFill>',
  ])("replaces the whole fill and only its bytes: %s", (fill) => {
    const xml = slide(`<p:spPr>${beforeGeometry}\n${fill}\r\n${afterGeometry}</p:spPr>`)
    expect(write(xml)).toBe(xml.replace(fill, solid))
    expect(write(xml, { none: true })).toBe(xml.replace(fill, "<a:noFill/>"))
  })

  it.each([
    [{ none: true }, "<a:noFill/>"],
    [{ group: true }, "<a:grpFill/>"],
    [
      { solid: { scheme: "accent1", transforms: [{ op: "lumMod", val: 75_000 }] } },
      '<a:solidFill><a:schemeClr val="accent1"><a:lumMod val="75000"/></a:schemeClr></a:solidFill>',
    ],
    [
      gradient,
      '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="accent1"/></a:gs><a:gs pos="100000"><a:schemeClr val="accent1"><a:lumMod val="50000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="1"/></a:gradFill>',
    ],
    [
      radial,
      '<a:gradFill rotWithShape="0"><a:gsLst><a:gs pos="0"><a:srgbClr val="FFFFFF"/></a:gs><a:gs pos="40000"><a:schemeClr val="bg1"/></a:gs><a:gs pos="100000"><a:srgbClr val="000000"/></a:gs></a:gsLst><a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path></a:gradFill>',
    ],
    [
      pattern,
      '<a:pattFill prst="dkDnDiag"><a:fgClr><a:schemeClr val="accent2"/></a:fgClr><a:bgClr><a:schemeClr val="bg1"/></a:bgClr></a:pattFill>',
    ],
  ] as const)("writes %j as DrawingML and reads it back", (value, xml) => {
    expect(fillMarkup(value).xml).toBe(xml)
    const written = slide(`<p:spPr>${beforeGeometry}${xml}</p:spPr>`)
    const picture = '<a:blipFill><a:blip r:embed="rId2"/></a:blipFill>'
    expect(write(slide(`<p:spPr>${beforeGeometry}${picture}</p:spPr>`), value)).toBe(written)
    expect(shownFill(parts(written), { part, shape: "2" })).toEqual({ value, own: true })
    expect(write(written, value)).toBe(written)
  })

  it("goes back to the inherited fill by removing only the shape's own fill", () => {
    const fill = '<a:gradFill rotWithShape="1"><a:gsLst/></a:gradFill>'
    const xml = slide(`<p:spPr>${beforeGeometry}${fill}${afterGeometry}</p:spPr>`)
    expect(edit(xml, "inherit")).toBe(xml.replace(fill, ""))
    const bare = slide(`<p:spPr>${beforeGeometry}</p:spPr>`)
    expect(edit(bare, "inherit")).toBe(bare)
    expect(edit(xml, "opening")).toBe(xml)
  })

  it.each(["p:pic", "p:grpSp", "p:graphicFrame", "p:cxnSp"])("refuses %s without writing", (kind) => {
    refuses(slide("<p:spPr/>", kind), "fill-shape")
  })

  it("refuses missing, duplicate properties and two fill choices", () => {
    refuses(slide(""), "fill-properties")
    refuses(slide("<p:spPr/><p:spPr/>"), "fill-properties")
    refuses(slide("<p:spPr><a:noFill/><a:solidFill/></p:spPr>"), "fill-choice")
  })

  it("addresses a nested shape without changing its parent or sibling", () => {
    const child = slide("<p:spPr><a:noFill/></p:spPr>")
    const xml = `<p:grpSp><p:cNvPr id="8"/><p:grpSpPr/>${child}</p:grpSp>`
    expect(write(xml)).toBe(xml.replace("<a:noFill/>", solid))
  })

  it.each([
    ["ppt/slideLayouts/slideLayout1.xml", "p:sldLayout"],
    ["ppt/slideMasters/slideMaster1.xml", "p:sldMaster"],
  ])("sets the fill of a shape on %s", (name, root) => {
    const xml = slide("<p:spPr><a:noFill/></p:spPr>").replace("<p:sld>", `<${root}>`).replace("</p:sld>", `</${root}>`)
    expect(write(xml, blue, name)).toBe(xml.replace("<a:noFill/>", solid))
  })
})

describe("the fill a shape shows", () => {
  it("reads a fill from the shape's style with the reference's colour in place of phClr, and writes nothing equal", async () => {
    const shapes = await deck("shapes-added.pptx")
    const at = { slide: "256", part, shape: "4" }
    expect(shownFill(shapes, at)).toEqual({ value: { solid: { scheme: "accent1" } }, own: false })
    expect(writeTrait(shapes, at, "fill", { value: { set: { solid: { scheme: "accent1" } } } })).toBe(shapes)
    const filled = writeTrait(shapes, at, "fill", { value: { set: blue } })
    expect(shownFill(filled, at)).toEqual({ value: blue, own: true })
    expect(decodeUtf8(filled.get(part)!)).toContain(`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${solid}</p:spPr>`)
    expect(writeTrait(filled, at, "fill", { value: "inherit" }).get(part)).toEqual(shapes.get(part))
  })

  it("reads a reference into the theme's background fills, and no fill for index 0", async () => {
    const shapes = await deck("shapes-added.pptx")
    const at = { slide: "256", part, shape: "4" }
    const referred = (index: string) => {
      const slide = decodeUtf8(shapes.get(part)!).replace('<a:fillRef idx="1">', `<a:fillRef idx="${index}">`)
      return new Map([...shapes, [part, encodeUtf8(slide)]])
    }
    expect(shownFill(referred("1001"), at)).toEqual({ value: { solid: { scheme: "accent1" } }, own: false })
    expect(shownFill(referred("1009"), at)).toEqual({ value: null, own: false })
    expect(shownFill(referred("0"), at)).toEqual({ value: { none: true }, own: false })
  })

  it("reads a fill the types cannot hold as no value, so a person replaces it whole", () => {
    const picture = slide('<p:spPr><a:blipFill><a:blip r:embed="rId2"/></a:blipFill></p:spPr>')
    expect(shownFill(parts(picture), { part, shape: "2" })).toEqual({ value: null, own: true })
    const one = slide(
      '<p:spPr><a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="FFFFFF"/></a:gs></a:gsLst></a:gradFill></p:spPr>',
    )
    expect(shownFill(parts(one), { part, shape: "2" })).toEqual({ value: null, own: true })
    expect(shownFill(parts(picture), { part, shape: "9" })).toBeNull()
  })

  it.each(["clean.pptx", "shapes-added.pptx", "nasa-1d-cnn.pptx", "census-updating-spm.pptx", "doe-heat-pumps.pptx"])(
    "changes only one shape's fill in %s when the route run fills a shape",
    async (name) => {
      const opened = await deck(name)
      const run = routeRuns(opened).find((each) => each.operation === "spPr.fill")
      if (run?.parts == null) throw new Error(run?.error ?? "no fill run")
      const changed = [...opened].filter(([key, bytes]) => run.parts?.get(key) !== bytes)
      expect(changed.length).toBe(1)
      const [[key, old] = ["", new Uint8Array()]] = changed
      const next = run.parts.get(key) ?? new Uint8Array()
      const { elements } = markupDocument(next)
      const color = elements.find(
        (item) => item.kind === "a:srgbClr" && item.attributes.some((a) => a.value === "19A7E8"),
      )
      const fill = elements.find((item) => item.index === color?.parent) as MarkupElement
      const spPr = elements.find((item) => item.index === fill.parent)
      expect([fill.kind, spPr?.kind]).toEqual(["a:solidFill", "p:spPr"])
      const before = markupDocument(old).elements.find((item) => item.start === fill.start && fillKinds.has(item.kind))
      expect(cut(next, fill)).toBe(cut(old, before))
    },
  )
})
