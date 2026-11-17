import { expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { templateStyle } from "./template-style.js"
import { themeXml } from "./trait-xml-theme.js"

const xml =
  '<a:theme name="日本 &amp; Design"><a:themeElements><a:fontScheme><a:majorFont><a:latin typeface="Heading" charset="00" pitchFamily="34"/><a:ea typeface="日本語"/><a:cs typeface="العربية"/><a:font script="Jpan" typeface="游明朝"/></a:majorFont><a:minorFont><a:latin typeface="Body"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>'
const rel = (type: string, target: string) =>
  encodeUtf8(`<Relationships><Relationship Type="x/${type}" Target="${target}"/></Relationships>`)
const parts = new Map([
  ["ppt/slides/_rels/slide1.xml.rels", rel("slideLayout", "../slideLayouts/slideLayout1.xml")],
  ["ppt/slideLayouts/_rels/slideLayout1.xml.rels", rel("slideMaster", "../slideMasters/slideMaster1.xml")],
  ["ppt/slideMasters/_rels/slideMaster1.xml.rels", rel("theme", "../theme/theme2.xml")],
  ["ppt/theme/theme1.xml", encodeUtf8('<a:theme name="Wrong theme"/>')],
  ["ppt/theme/theme2.xml", encodeUtf8(xml)],
])

it("reads the current slide's imported name and differing fonts through its own chain", () => {
  expect(templateStyle(parts, "ppt/slides/slide1.xml")).toMatchObject({
    name: "日本 & Design",
    major: "Heading",
    minor: "Body",
  })
})

it("leaves missing names and absent chains neutral instead of borrowing another theme", () => {
  const unnamed = new Map(parts).set("ppt/theme/theme2.xml", encodeUtf8(xml.replace(' name="日本 &amp; Design"', "")))
  expect(templateStyle(unnamed, "ppt/slides/slide1.xml").name).toBeNull()
  expect(templateStyle(parts, "ppt/slides/slide2.xml")).toEqual({ name: null, major: null, minor: null, swatches: [] })
})

it("changes only the Latin typeface bytes, preserving attributes and non-Latin fonts", () => {
  const field = themeXml.fields.major
  if (field.at !== "whole") throw new Error("whole")
  const next = field.codec.write(parts, { part: "ppt/theme/theme2.xml", slide: "1", shape: "" }, "Georgia")
  expect(decodeUtf8(next.get("ppt/theme/theme2.xml") ?? new Uint8Array())).toBe(
    xml.replace('typeface="Heading"', 'typeface="Georgia"'),
  )
  expect(next.get("ppt/theme/theme1.xml")).toBe(parts.get("ppt/theme/theme1.xml"))
})

it("escapes a new typeface inside an imported single-quoted attribute", () => {
  const quoted = xml.replace('typeface="Heading"', "typeface='Heading'")
  const opening = new Map(parts).set("ppt/theme/theme2.xml", encodeUtf8(quoted))
  const field = themeXml.fields.major
  if (field.at !== "whole") throw new Error("whole")
  const next = field.codec.write(opening, { part: "ppt/theme/theme2.xml", slide: "1", shape: "" }, "New 'Font' & Co")
  expect(decodeUtf8(next.get("ppt/theme/theme2.xml") ?? new Uint8Array())).toBe(
    quoted.replace("typeface='Heading'", "typeface='New &apos;Font&apos; &amp; Co'"),
  )
})
