import { expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { blurRadius } from "./picture-adjust.js"
import { shownImage } from "./picture-read.js"
import { writeTrait } from "./trait-xml.js"

const part = "ppt/slides/slide1.xml"
const at = { slide: "256", part, shape: "2" }

function slide(properties: string): Map<string, Uint8Array> {
  const xml = `<?xml version="1.0"?><p:sld><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Shape 2"/></p:nvSpPr>${properties}</p:sp></p:spTree></p:cSld></p:sld>`
  return new Map([[part, encodeUtf8(xml)]])
}

const picture = `<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="4572000" cy="3048000"/></a:xfrm><a:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></a:blipFill></p:spPr>`

it("writes blur and tile inside a shape's picture fill", () => {
  const next = writeTrait(slide(picture), at, "fills", {
    mode: { set: "tile" },
    blur: { set: 40_000 },
  })
  const xml = decodeUtf8(next.get(part)!)
  expect(xml).toContain('<a:tile tx="0" ty="0" sx="100000" sy="100000" algn="tl"/>')
  expect(xml).toContain(`<a:blur rad="${String(blurRadius(40_000))}" grow="0"/>`)
  expect(xml).toContain("</a:blipFill>")
  expect(xml).not.toContain("</p:blipFill>")
  expect(xml).toContain('cx="4572000"')
  expect(shownImage(next, at)).toMatchObject({ blur: 40_000 })
})

it("refuses a mode on a picture fill with no image in it", () => {
  const closed = `<p:spPr><a:blipFill/></p:spPr>`
  expect(() => writeTrait(slide(closed), at, "fills", { mode: { set: "tile" } })).toThrow("picture-fill")
})

it("keeps an image's settings out of the file while the shape's fills hold no image", () => {
  const solid = slide(`<p:spPr><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:spPr>`)
  const settings = {
    crop: { set: { l: 10_000, t: 0, r: 0, b: 0 } },
    mode: { set: "tile" },
    blur: { set: 40_000 },
  } as const
  expect(writeTrait(solid, at, "fills", settings)).toBe(solid)
  const switched = writeTrait(slide(picture), at, "fills", { p0: { set: { solid: { rgb: "FF0000" } } }, ...settings })
  expect(decodeUtf8(switched.get(part)!)).toContain('<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:spPr>')
  expect(decodeUtf8(switched.get(part)!)).not.toContain("blip")
})
