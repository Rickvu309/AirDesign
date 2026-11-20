import { describe, expect, it } from "vitest"
import { maskWritten } from "./mask-extension.js"
import { openedMasks } from "./mask-open.js"
import { maskRuns } from "./mask-runs.js"
import { bakedMask } from "./mask-stand.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"

const part = "ppt/slides/slide1.xml"
const tags = `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"`
const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>`
const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`
const text = (parts: ReadonlyMap<string, Uint8Array>) => decodeUtf8(parts.get(part) ?? new Uint8Array())

const xfrm = (x: number, y: number, cx: number, cy: number) =>
  `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`

const oval = (id: string, x: number, y: number, size: number) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Oval ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(x, y, size, size)}<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="000000"/></a:solidFill></p:spPr></p:sp>`

const photo = (id: string, x: number, y: number, cx: number, cy: number, crop = "") =>
  `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Photo ${id}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/>${crop}<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(x, y, cx, cy)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`

const label = (id: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Label ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(0, 0, 1000, 1000)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>Hi</a:t></a:r></a:p></p:txBody></p:sp>`

const group = (inner: string) =>
  `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="9" name="Mask group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="4000" cy="4000"/><a:chOff x="0" y="0"/><a:chExt cx="4000" cy="4000"/></a:xfrm></p:grpSpPr>${inner}</p:grpSp>`

function deck(inner: string, masks: readonly string[] = ["2"]): ReadonlyMap<string, Uint8Array> {
  let parts: ReadonlyMap<string, Uint8Array> = new Map([
    [part, encodeUtf8(`<p:sld ${tags}><p:cSld><p:spTree>${inner}</p:spTree></p:cSld></p:sld>`)],
    ["ppt/slides/_rels/slide1.xml.rels", encodeUtf8(rels)],
    ["[Content_Types].xml", encodeUtf8(types)],
    ["ppt/media/image1.png", new Uint8Array([1, 2, 3])],
  ])
  for (const shape of masks) parts = maskWritten(parts, { slide: "256", part, shape }, true)
  return parts
}

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

describe("an image masked by one shape exports as a picture with the shape's outline", () => {
  const parts = deck(group(`${oval("2", 1000, 1000, 2000)}${photo("3", 0, 0, 4000, 2000)}`))

  it("finds the native run", () => {
    expect(maskRuns(parts.get(part)!)).toEqual([{ mask: "2", masked: ["3"], run: ["2", "3"], look: "native" }])
  })

  it("writes the shape's outline and place on the picture, cropped to the shape, and hides the two layers", () => {
    const baked = text(bakedMask(parts, part, "2", null))
    expect(baked).toContain('<p:cNvPr id="2" name="Oval 2" hidden="1"/>')
    expect(baked).toContain('<p:cNvPr id="3" name="Photo 3" hidden="1"/>')
    expect(baked).toContain(
      `<p:pic><p:nvPicPr><p:cNvPr id="10" name="Photo 3"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:srcRect l="25000" t="50000" r="25000" b="-50000"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(1000, 1000, 2000, 2000)}<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:grpSp>`,
    )
    expect(baked).toMatch(
      /<adm:mask xmlns:adm="[^"]+"><adm:stand picture="10" hid="2 3" digest="[0-9a-f]{16}"\/><\/adm:mask><\/a:ext>/,
    )
  })

  it("keeps the picture's own crop inside the shape's crop", () => {
    const cropped = deck(group(`${oval("2", 0, 0, 2000)}${photo("3", 0, 0, 2000, 2000, '<a:srcRect l="50000"/>')}`))
    expect(text(bakedMask(cropped, part, "2", null))).toContain('<a:srcRect l="50000"/>')
  })

  it("reads the export back as the mask and writes the same bytes again when nobody touched it", () => {
    const baked = bakedMask(parts, part, "2", null)
    const opened = openedMasks(baked)
    expect(text(opened)).not.toContain("hidden")
    expect(text(opened)).not.toContain('<p:cNvPr id="10"')
    expect(maskRuns(opened.get(part)!)).toEqual([{ mask: "2", masked: ["3"], run: ["2", "3"], look: "kept" }])
    expect(text(bakedMask(opened, part, "2", null))).toBe(text(baked))
  })

  it("bakes again once a masked layer changed after the import", () => {
    const opened = openedMasks(bakedMask(parts, part, "2", null))
    const moved = new Map(opened)
    moved.set(
      part,
      encodeUtf8(
        text(opened).replace(
          '<a:off x="0" y="0"/><a:ext cx="4000" cy="2000"/>',
          '<a:off x="1000" y="0"/><a:ext cx="4000" cy="2000"/>',
        ),
      ),
    )
    expect(maskRuns(moved.get(part)!)[0]?.look).toBe("native")
    expect(text(bakedMask(moved, part, "2", null))).toContain('<a:srcRect t="50000" r="50000" b="-50000"/>')
  })
})

describe("anything else masked exports as a picture of how it looks", () => {
  const parts = deck(group(`${oval("2", 1000, 1000, 2000)}${photo("3", 0, 0, 4000, 2000)}${label("4")}`))

  it("asks for a picture and places it at the mask's box, hiding every masked layer", () => {
    expect(maskRuns(parts.get(part)!)[0]?.look).toBe("picture")
    expect(() => bakedMask(parts, part, "2", null)).toThrow("mask-picture")
    const baked = bakedMask(parts, part, "2", png)
    const written = text(baked)
    expect(written).toContain('<p:cNvPr id="4" name="Label 4" hidden="1"/>')
    expect(written).toContain(
      `<p:spPr>${xfrm(1000, 1000, 2000, 2000)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:grpSp>`,
    )
    expect(written).toMatch(/hid="2 3 4"/)
    expect([...baked.keys()].filter((name) => name.startsWith("ppt/media/"))).toHaveLength(2)
    const opened = openedMasks(baked)
    expect(maskRuns(opened.get(part)!)[0]?.look).toBe("kept")
    expect(text(bakedMask(opened, part, "2", null))).toBe(written)
  })

  it("stops a mask's layers at the next mask, and skips a hidden mask", () => {
    const two = deck(
      group(`${oval("2", 0, 0, 1000)}${photo("3", 0, 0, 1000, 1000)}${oval("5", 0, 0, 1000)}${label("4")}`),
      ["2", "5"],
    )
    expect(maskRuns(two.get(part)!).map((run) => run.run)).toEqual([
      ["2", "3"],
      ["5", "4"],
    ])
    const hidden = deck(
      group(`${oval("2", 0, 0, 1000).replace('name="Oval 2"', 'name="Oval 2" hidden="1"')}${label("4")}`),
    )
    expect(maskRuns(hidden.get(part)!)).toEqual([])
  })

  it("hides a mask with nothing above it and shows it again on import", () => {
    const alone = deck(oval("2", 0, 0, 1000))
    expect(maskRuns(alone.get(part)!)[0]?.look).toBe("none")
    const baked = bakedMask(alone, part, "2", null)
    expect(text(baked)).toContain('name="Oval 2" hidden="1"')
    expect(text(openedMasks(baked))).not.toContain("hidden")
    expect(text(bakedMask(openedMasks(baked), part, "2", null))).toBe(text(baked))
  })
})
