import type { TextValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { markupDocument, spliceBytes } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { markupChildren, textValueEdits } from "./text-value-route.js"

function apply(inner: string, value: TextValue): string {
  const xml = `<p:sp><p:txBody><a:bodyPr/>${inner}</p:txBody></p:sp>`
  const bytes = encodeUtf8(xml)
  const elements = markupDocument(bytes).elements
  const shape = elements.find((element) => element.kind === "p:sp")
  if (shape === undefined) throw new Error("shape")
  return decodeUtf8(spliceBytes(bytes, textValueEdits(markupChildren(elements), bytes, shape, value)))
}

const rich =
  '<a:p><a:pPr marL="10"><a:buFont typeface="Arial"/><a:buNone/><a:ghost/><a:defRPr sz="1800"/></a:pPr><a:r><a:rPr lang="en-US"><a:solidFill><a:schemeClr val="dk1"><a:lumMod val="50000"/></a:schemeClr></a:solidFill><a:mystery/></a:rPr><a:t>Hi</a:t></a:r></a:p>'

const kept = '<a:solidFill><a:schemeClr val="dk1"><a:lumMod val="50000"/></a:schemeClr></a:solidFill>'

it("keeps a fill it does not understand when it sets bold or size", () => {
  const bold = apply(rich, [{ from: 0, runs: [{ from: 0, text: "Hi", bold: true }] }])
  expect(bold).toContain(kept)
  expect(bold).toContain("<a:mystery/>")
  expect(bold).toContain("<a:ghost/>")
  expect(bold).toContain('b="1"')
  const sized = apply(rich, [{ from: 0, runs: [{ from: 0, text: "Hi", size: 2750 }] }])
  expect(sized).toContain(kept)
  expect(sized).toContain("<a:mystery/>")
  expect(sized).toContain('sz="2750"')
})

it("writes a scheme colour or an rgb colour in place of the fill and keeps the unknown child", () => {
  const scheme = apply(rich, [{ from: 0, runs: [{ from: 0, text: "Hi", color: { scheme: "accent2" } }] }])
  expect(scheme).toContain('<a:solidFill><a:schemeClr val="accent2"/></a:solidFill>')
  expect(scheme).not.toContain("lumMod")
  expect(scheme).toContain("<a:mystery/>")
  expect(scheme).toContain('lang="en-US"')
  const rgb = apply(rich, [{ from: 0, runs: [{ from: 0, text: "Hi", color: { rgb: "FF0000" } }] }])
  expect(rgb).toContain('<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>')
  expect(rgb).toContain("<a:mystery/>")
})

it("sets alignment and bullets on the paragraph and keeps the properties it does not own", () => {
  const aligned = apply(rich, [{ from: 0, align: "center", runs: [{ from: 0, text: "Hi" }] }])
  expect(aligned).toContain('marL="10" algn="ctr"')
  expect(aligned).toContain("<a:ghost/>")
  expect(aligned).toContain('<a:defRPr sz="1800"/>')
  expect(aligned).toContain(kept)
  const on = apply(rich, [{ from: 0, list: "bullets", runs: [{ from: 0, text: "Hi" }] }])
  expect(on).toContain('<a:buFont typeface="Arial"/><a:buChar char="•"/>')
  expect(on).not.toContain("buNone")
  expect(on).toContain("<a:ghost/>")
  expect(on).toContain('<a:defRPr sz="1800"/>')
  const off = apply(rich.replace("<a:buNone/>", '<a:buChar char="•"/>'), [
    { from: 0, list: "none", runs: [{ from: 0, text: "Hi" }] },
  ])
  expect(off).toContain('<a:buFont typeface="Arial"/><a:buNone/>')
  expect(off).toContain("<a:ghost/>")
})

it("inserts a bullet between the bullet font and the default run properties", () => {
  const inner = rich.replace("<a:buNone/>", "")
  const on = apply(inner, [{ from: 0, list: "bullets", runs: [{ from: 0, text: "Hi" }] }])
  expect(on).toContain('<a:buFont typeface="Arial"/><a:buChar char="•"/><a:ghost/>')
})

it("keeps the fill and the unknown child when a new run forces the paragraph to be rewritten", () => {
  const next = apply(rich, [
    {
      from: 0,
      align: "right",
      runs: [
        { from: 0, text: "H" },
        { from: -1, text: "i", size: 2000, color: { scheme: "lt1" } },
      ],
    },
  ])
  expect(next).toContain('algn="r"')
  expect(next).toContain(kept)
  expect(next).toContain("<a:mystery/>")
  expect(next).toContain("<a:ghost/>")
  expect(next).toContain('<a:rPr sz="2000"><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:rPr><a:t>i</a:t>')
})
