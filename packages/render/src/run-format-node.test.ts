import type { Color } from "@airdesign/document"
import { expect, it } from "vitest"
import { readFormat, writeFormat } from "./run-format-node.js"

function throughSpan(color: Color): { readonly attribute: string | undefined; readonly read: Color | undefined } {
  const span = document.createElement("span")
  writeFormat(span, { color })
  return { attribute: span.dataset.color, read: readFormat(span).color }
}

it("keeps today's attribute for a colour with no transforms", () => {
  expect(throughSpan({ scheme: "accent1" })).toEqual({ attribute: "scheme:accent1", read: { scheme: "accent1" } })
  expect(throughSpan({ rgb: "0F2433" })).toEqual({ attribute: "rgb:0F2433", read: { rgb: "0F2433" } })
})

it.each<Color>([
  {
    scheme: "accent1",
    transforms: [
      { op: "lumMod", val: 75000 },
      { op: "lumOff", val: 25000 },
    ],
  },
  { scheme: "tx1" },
  { rgb: "000000", transforms: [{ op: "alpha", val: 35000 }, { op: "comp" }] },
  { system: "windowText", last: "000000", transforms: [{ op: "hueOff", val: -60000 }] },
  { preset: "dkSlateBlue" },
])("keeps a run's colour through an edit, every transform in order: %j", (color) => {
  expect(throughSpan(color).read).toEqual(color)
})

it.each(["scheme:accent7", "rgb:fff", "scheme:accent1 lumMod", "scheme:accent1 comp:1", "scheme:accent1 lumMod:x"])(
  "reads no colour from %s",
  (attribute) => {
    const span = document.createElement("span")
    span.dataset.color = attribute
    expect(readFormat(span).color).toBeUndefined()
  },
)
