import { expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { swatchBlack, swatchDk, swatchLt } from "./theme-swatches-art.js"
import { themeSwatches } from "./theme-swatches.js"

const theme = encodeUtf8(
  `<a:theme><a:themeElements><a:clrScheme name="Office"><a:dk1><a:srgbClr val="${swatchDk.slice(1)}"/></a:dk1><a:lt1><a:srgbClr val="${swatchLt.slice(1)}"/></a:lt1></a:clrScheme></a:themeElements></a:theme>`,
)

it("reads scheme colours from the first theme when a slide has no chain", () => {
  const parts = new Map([["ppt/theme/theme1.xml", theme]])
  expect(themeSwatches(parts, null)).toEqual([
    { scheme: "dk1", css: swatchDk },
    { scheme: "lt1", css: swatchLt },
  ])
})

it("follows a slide through its layout and master to that theme", () => {
  const other = encodeUtf8(
    `<a:theme><a:themeElements><a:clrScheme><a:dk1><a:srgbClr val="${swatchBlack.slice(1)}"/></a:dk1></a:clrScheme></a:themeElements></a:theme>`,
  )
  const rel = (type: string, target: string) =>
    encodeUtf8(`<Relationships><Relationship Id="r1" Type="http://x/${type}" Target="${target}"/></Relationships>`)
  const parts = new Map<string, Uint8Array>([
    ["ppt/slides/slide1.xml", encodeUtf8("<p:sld/>")],
    ["ppt/slides/_rels/slide1.xml.rels", rel("slideLayout", "../slideLayouts/slideLayout1.xml")],
    ["ppt/slideLayouts/slideLayout1.xml", encodeUtf8("<p:sldLayout/>")],
    ["ppt/slideLayouts/_rels/slideLayout1.xml.rels", rel("slideMaster", "../slideMasters/slideMaster1.xml")],
    ["ppt/slideMasters/slideMaster1.xml", encodeUtf8("<p:sldMaster/>")],
    ["ppt/slideMasters/_rels/slideMaster1.xml.rels", rel("theme", "../theme/theme2.xml")],
    ["ppt/theme/theme1.xml", other],
    ["ppt/theme/theme2.xml", theme],
  ])
  expect(themeSwatches(parts, "ppt/slides/slide1.xml")[0]).toEqual({ scheme: "dk1", css: swatchDk })
})

function chained(master: string, slide = "<p:sld/>"): Map<string, Uint8Array> {
  const rel = (type: string, target: string) =>
    encodeUtf8(`<Relationships><Relationship Id="r1" Type="http://x/${type}" Target="${target}"/></Relationships>`)
  return new Map<string, Uint8Array>([
    ["ppt/slides/slide1.xml", encodeUtf8(slide)],
    ["ppt/slides/_rels/slide1.xml.rels", rel("slideLayout", "../slideLayouts/slideLayout1.xml")],
    ["ppt/slideLayouts/slideLayout1.xml", encodeUtf8("<p:sldLayout/>")],
    ["ppt/slideLayouts/_rels/slideLayout1.xml.rels", rel("slideMaster", "../slideMasters/slideMaster1.xml")],
    ["ppt/slideMasters/slideMaster1.xml", encodeUtf8(master)],
    ["ppt/slideMasters/_rels/slideMaster1.xml.rels", rel("theme", "../theme/theme1.xml")],
    ["ppt/theme/theme1.xml", theme],
  ])
}

const darkMaster = '<p:sldMaster><p:clrMap bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2"/></p:sldMaster>'

it("names the mapped colours each swatch answers to on a dark master", () => {
  expect(themeSwatches(chained(darkMaster), "ppt/slides/slide1.xml")).toEqual([
    { scheme: "dk1", css: swatchDk, mapped: ["bg1"] },
    { scheme: "lt1", css: swatchLt, mapped: ["tx1"] },
  ])
})

it("lets a slide's own colour map override its master's", () => {
  const slide =
    '<p:sld><p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2"/></p:clrMapOvr></p:sld>'
  expect(themeSwatches(chained(darkMaster, slide), "ppt/slides/slide1.xml")).toEqual([
    { scheme: "dk1", css: swatchDk, mapped: ["tx1"] },
    { scheme: "lt1", css: swatchLt, mapped: ["bg1"] },
  ])
})
