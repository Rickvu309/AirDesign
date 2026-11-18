import { describe, expect, it } from "vitest"
import { slideId } from "@airdesign/document"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { relsOf } from "./package-address.js"
import { linkXml, shownLink, withoutSlideLinks } from "./trait-xml-link.js"
import { writeFields } from "./xml-codec.js"
import { textXml } from "./trait-xml-text.js"

const part = "ppt/slides/slide1.xml"
const at = { slide: "256", part, shape: "2" }
const run = '<a:r><a:rPr><a:hlinkClick r:id="rId1"/></a:rPr><a:t>linked phrase</a:t></a:r>'
const hover = '<a:hlinkMouseOver r:id="rId1" tooltip="hover"/>'
const extra = '<a:extLst><a:ext uri="keep"/></a:extLst>'
const relation =
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://old.example" TargetMode="External"/>'

function opened(click = "") {
  return new Map([
    [
      part,
      encodeUtf8(
        `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Text">${click}${hover}</p:cNvPr></p:nvSpPr><p:txBody><a:p>${run}</a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
      ),
    ],
    [
      relsOf(part),
      encodeUtf8(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relation}</Relationships>`,
      ),
    ],
    [
      "ppt/presentation.xml",
      encodeUtf8(
        '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="258" r:id="rId2"/></p:sldIdLst></p:presentation>',
      ),
    ],
    [
      "ppt/_rels/presentation.xml.rels",
      encodeUtf8(
        '<Relationships><Relationship Id="rId1" Target="slides/slide1.xml" Type="x/slide"/><Relationship Id="rId2" Target="slides/slide2.xml" Type="x/slide"/></Relationships>',
      ),
    ],
    ["ppt/slides/slide2.xml", encodeUtf8("<p:sld/>")],
    ["untouched.bin", encodeUtf8("original")],
  ])
}

describe("native whole-element click links", () => {
  it("does not report a rich-run link as an object link", () => {
    expect(shownLink(opened(), at)).toEqual({ kind: "none" })
  })
  it("allocates a collision-free relationship and preserves shared run links, hover and click extras", () => {
    const before = opened(`<a:hlinkClick r:id="rId1" tooltip="kept" history="0">${extra}</a:hlinkClick>`)
    const after = writeFields(before, at, linkXml, {
      target: { set: { kind: "url", url: "https://new.example/?a=1&b=2" } },
    })
    expect(shownLink(after, at)).toEqual({ kind: "url", url: "https://new.example/?a=1&b=2" })
    const xml = decodeUtf8(after.get(part)!)
    expect(xml).toContain('r:id="rId2"')
    for (const kept of [run, hover, extra, 'tooltip="kept"', 'history="0"']) expect(xml).toContain(kept)
    expect(decodeUtf8(after.get(relsOf(part))!)).toContain(relation)
    for (const [path, bytes] of before) if (![part, relsOf(part)].includes(path)) expect(after.get(path)).toBe(bytes)
  })
  it("preserves unsupported actions until explicitly removed or replaced", () => {
    const before = opened('<a:hlinkClick action="ppaction://macro?name=run"/>')
    expect(shownLink(before, at)).toEqual({ kind: "unsupported" })
    expect(writeFields(before, at, linkXml, {})).toBe(before)
    const after = writeFields(before, at, linkXml, { target: { set: { kind: "none" } } })
    expect(shownLink(after, at)).toEqual({ kind: "none" })
    expect(decodeUtf8(after.get(part)!)).toContain(run)
    expect(decodeUtf8(after.get(part)!)).toContain(hover)
    expect(after.get(relsOf(part))).toBe(before.get(relsOf(part)))
  })
  it("targets the stable slide part, follows reorder, and removes dangling destinations", () => {
    const original = opened()
    const linked = writeFields(original, at, linkXml, { target: { set: { kind: "slide", slide: slideId("258") } } })
    expect(shownLink(linked, at)).toEqual({ kind: "slide", slide: "258" })
    const reordered = new Map(linked)
    reordered.set(
      "ppt/presentation.xml",
      encodeUtf8(
        '<p:presentation><p:sldIdLst><p:sldId id="258" r:id="rId2"/><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>',
      ),
    )
    expect(shownLink(reordered, at)).toEqual({ kind: "slide", slide: "258" })
    withoutSlideLinks(reordered, "ppt/slides/slide2.xml")
    expect(shownLink(reordered, at)).toEqual({ kind: "none" })
    expect(decodeUtf8(reordered.get(relsOf(part))!)).not.toContain('Target="slide2.xml"')
    const missing = writeFields(original, at, linkXml, { target: { set: { kind: "slide", slide: slideId("999") } } })
    expect(shownLink(missing, at)).toEqual({ kind: "none" })
  })
})

it("writes phrase destinations natively without changing the object or shared relationship", () => {
  const before = opened()
  const text = [
    {
      from: 0,
      runs: [
        { from: 0, text: "linked ", link: { kind: "url", url: "https://new.example" } },
        { from: 0, text: "phrase", link: { kind: "slide", slide: slideId("258") } },
      ],
    },
  ]
  const after = writeFields(before, at, textXml, { value: { set: JSON.stringify(text) } })
  expect(shownLink(after, { ...at, paragraph: 0, run: 0 })).toEqual(text[0]!.runs[0]!.link)
  expect(shownLink(after, { ...at, paragraph: 0, run: 1 })).toEqual(text[0]!.runs[1]!.link)
  expect(shownLink(after, at)).toEqual({ kind: "none" })
  expect(decodeUtf8(after.get(relsOf(part))!)).toContain(relation)
  expect(after.get("untouched.bin")).toBe(before.get("untouched.bin"))
  expect(decodeUtf8(after.get(part)!)).toContain(hover)
})

it("keeps an imported unsupported run action through a different run's link edit", () => {
  const before = opened()
  before.set(
    part,
    encodeUtf8(
      decodeUtf8(before.get(part)!).replace(
        '<a:hlinkClick r:id="rId1"/>',
        '<a:hlinkClick action="ppaction://macro?name=kept"/>',
      ),
    ),
  )
  const after = writeFields(before, at, textXml, {
    value: {
      set: JSON.stringify([
        {
          from: 0,
          runs: [
            { from: 0, text: "linked ", link: { kind: "unsupported" } },
            { from: 0, text: "phrase", link: { kind: "url", url: "https://example.com" } },
          ],
        },
      ]),
    },
  })
  expect(shownLink(after, { ...at, paragraph: 0, run: 0 })).toEqual({ kind: "unsupported" })
  expect(decodeUtf8(after.get(part)!)).toContain('<a:hlinkClick action="ppaction://macro?name=kept"/>')
  expect(shownLink(after, { ...at, paragraph: 0, run: 1 })).toEqual({ kind: "url", url: "https://example.com" })
})
