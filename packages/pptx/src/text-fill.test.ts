import { expect, it } from "vitest"
import type { TextFill } from "@airdesign/document"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { requireMarkup } from "./part-markup.js"
import { runProperties } from "./run-format.js"
import { runFill } from "./text-fill-read.js"
import { markupChildren } from "./text-value-route.js"

const fill: TextFill = {
  gradient: {
    stops: [
      { pos: 0, color: { rgb: "FF0000" } },
      { pos: 100000, color: { scheme: "accent1" } },
    ],
    shade: { linear: { angle: 5400000, scaled: true } },
    rotateWithShape: true,
  },
}

it("writes a native gradient on a run and reads every stop and direction", () => {
  const bytes = runProperties(new Uint8Array(), undefined, { from: -1, text: "A", fill })
  const { elements } = requireMarkup(bytes)
  const element = elements[0]
  if (element === undefined) throw new Error("run")
  expect(decodeUtf8(bytes)).toContain("<a:gradFill")
  expect(runFill([{ element, children: markupChildren(elements) }])).toEqual(fill)
})

it("preserves untouched gradient and picture run properties byte for byte", () => {
  for (const paint of [
    '<a:gradFill flip="xy"><a:gsLst/></a:gradFill>',
    '<a:blipFill><a:blip r:embed="rId9"/></a:blipFill>',
  ]) {
    const bytes = encodeUtf8(`<a:rPr lang="vi-VN">${paint}<a:hlinkClick r:id="rId1"/></a:rPr>`)
    const root = requireMarkup(bytes).elements[0]
    expect(runProperties(bytes, root, { from: 0, text: "A" })).toEqual(bytes)
    const changed = decodeUtf8(runProperties(bytes, root, { from: 0, text: "A", fill: { solid: { rgb: "123456" } } }))
    expect(changed).toBe(
      '<a:rPr lang="vi-VN"><a:solidFill><a:srgbClr val="123456"/></a:solidFill><a:hlinkClick r:id="rId1"/></a:rPr>',
    )
  }
})
