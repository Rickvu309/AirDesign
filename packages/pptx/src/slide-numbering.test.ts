import { plainSlideNumber, writeTextValue, type TextValue } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { applyRoute, oneRunValue, textStorable } from "./slide-route.js"

import { textXml } from "./trait-xml-text.js"
import { shownLink } from "./trait-xml-link.js"
import { writeFields } from "./xml-codec.js"

const part = "ppt/slides/slide1.xml"

function boxOf(body: string, shape = "2"): Uint8Array {
  return encodeUtf8(
    `<p:spTree><p:sp><p:nvSpPr><p:cNvPr id="${shape}" name="Number"/></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/>${body}</p:txBody></p:sp></p:spTree>`,
  )
}

describe("writing a slide number", () => {
  it("writes a new field id in the uppercase GUID form Open XML requires", () => {
    const slide = "ppt/slides/slide2.xml"
    const shape = boxOf("<a:p/>", "3")
    const value: TextValue = [{ from: 0, runs: [{ from: -1, text: "1", slideNumber: plainSlideNumber }] }]
    const written = applyRoute(new Map([[slide, shape]]), { name: "text", part: slide, shape: "3", value })
    const xml = decodeUtf8(written.get(slide) ?? new Uint8Array())
    expect(xml).toMatch(/<a:fld id="\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}" type="slidenum">/)
  })

  it("retains the native number field and writes the total as ordinary text", () => {
    const box = boxOf(
      '<a:p><a:fld id="{DEADBEEF-1234-5678-1234-123456789ABC}" type="slidenum"><a:rPr b="1"/><a:t>7</a:t></a:fld></a:p>',
    )
    const parts = new Map([[part, box]])
    const value: TextValue = [
      { from: 0, runs: [{ from: 0, text: "7", slideNumber: { count: "all", format: "slash" } }] },
    ]
    const written = applyRoute(parts, {
      name: "text",
      part,
      shape: "2",
      value,
      numbers: { number: 2, total: 6, rowNumber: 1 },
    })
    const xml = decodeUtf8(written.get(part) ?? new Uint8Array())
    expect(xml).toContain(
      '<a:fld id="{DEADBEEF-1234-5678-1234-123456789ABC}" type="slidenum"><a:rPr b="1"/><a:t>2</a:t></a:fld><a:r><a:rPr b="1"/><a:t> / 6</a:t></a:r>',
    )
  })

  it("keeps a link on the word after a numbered field expands into two runs", () => {
    const box = boxOf('<a:p><a:fld id="{1}" type="slidenum"><a:t>7</a:t></a:fld><a:r><a:t>Next</a:t></a:r></a:p>')
    const link = { kind: "url", url: "https://example.org" } as const
    const value = writeTextValue([
      {
        from: 0,
        runs: [
          { from: 0, text: "7", slideNumber: { count: "all", format: "slash" } },
          { from: 1, text: "Next", link },
        ],
      },
    ])
    const at = { slide: "256", part, shape: "2", numbers: { number: 2, total: 6, rowNumber: 1 } }
    const written = writeFields(new Map([[part, box]]), at, textXml, { value: { set: value } })
    expect(shownLink(written, { ...at, paragraph: 0, run: 1 })).toEqual({ kind: "none" })
    expect(shownLink(written, { ...at, paragraph: 0, run: 2 })).toEqual(link)
  })

  it("writes row-relative ordinals as text because PowerPoint numbers the full deck", () => {
    const box = boxOf(
      '<a:p><a:fld id="{DEADBEEF-1234-5678-1234-123456789ABC}" type="slidenum"><a:rPr b="1"/><a:t>7</a:t></a:fld></a:p>',
    )
    const value: TextValue = [{ from: 0, runs: [{ from: 0, text: "7", slideNumber: { count: "row", format: "of" } }] }]
    const written = applyRoute(new Map([[part, box]]), {
      name: "text",
      part,
      shape: "2",
      value,
      numbers: { number: 7, total: 10, rowNumber: 2 },
    })
    const xml = decodeUtf8(written.get(part) ?? new Uint8Array())
    expect(xml).toContain('<a:p><a:r><a:rPr b="1"/><a:t>2 of 10</a:t></a:r></a:p>')
    expect(xml).not.toContain("a:fld")
  })

  it("leaves a field box to be refused by the route with its bytes unchanged", () => {
    const box = boxOf(`<a:p><a:fld id="{1}" type="slidenum"><a:rPr/><a:t>7</a:t></a:fld></a:p>`)
    expect(textStorable(new Map([[part, box]]), part, "2")).toBe(false)
    const saved = Uint8Array.from(box)
    expect(() => oneRunValue(new Map([[part, box]]), part, "2", "8")).toThrow(/text-carried/)
    expect(box).toEqual(saved)
  })
})
