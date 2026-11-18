import type { TextValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { applyRoute } from "./slide-route.js"

const part = "ppt/slides/slide1.xml"

const boxOf = (body: string): Uint8Array =>
  encodeUtf8(
    `<p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/>${body}</p:txBody></p:sp></p:spTree>`,
  )

function edited(before: Uint8Array, value: TextValue): Uint8Array {
  const after = applyRoute(new Map([[part, before]]), { name: "text", part, shape: "2", value }).get(part)
  if (after === undefined) throw new Error("part")
  return after
}

it("writes the words typed on a new line after a field as a run in the field's format", () => {
  const box = boxOf(
    `<a:p><a:r><a:rPr b="1"/><a:t>Page </a:t></a:r><a:fld id="{1}" type="slidenum"><a:rPr sz="1400"/><a:t>7</a:t></a:fld></a:p>`,
  )
  const written = decodeUtf8(
    edited(box, [
      {
        from: 0,
        runs: [
          { from: 0, text: "Page " },
          { from: 1, text: "7" },
        ],
      },
      { from: 0, runs: [{ from: 1, text: "typed" }] },
    ]),
  )
  expect(written).toContain(`<a:fld id="{1}" type="slidenum"><a:rPr sz="1400"/><a:t>7</a:t></a:fld>`)
  expect(written).toContain(`<a:r><a:rPr sz="1400"/><a:t>typed</a:t></a:r>`)
  expect(() =>
    edited(box, [
      {
        from: 0,
        runs: [
          { from: 0, text: "Page " },
          { from: 1, text: "8" },
        ],
      },
    ]),
  ).toThrow(/text-carried/)
})
