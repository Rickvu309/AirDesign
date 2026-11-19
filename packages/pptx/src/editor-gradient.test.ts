import { expect, it } from "vitest"
import type { Paint } from "@airdesign/document"
import { fillMarkup } from "./fill-markup.js"
import { fillValueOf } from "./fill-read.js"
import { encodeUtf8 } from "./package-bytes.js"
import { requireMarkup } from "./part-markup.js"
import { markupChildren } from "./text-value-route.js"

type Gradient = Extract<Paint, { gradient: unknown }>["gradient"]

const stops = [
  { pos: 0, color: { rgb: "112233" } },
  { pos: 100000, color: { rgb: "AABBCC" } },
]

it.each([
  { angular: { angle: 5_400_000, x: 20_000, y: 40_000 } },
  { diamond: { x: 20_000, y: 40_000, width: 30_000, height: 45_000 } },
])("retains editor gradient geometry until the browser bakes it", (shade) => {
  const gradient: Gradient = { stops, shade, rotateWithShape: true }
  const written = fillMarkup({ gradient })
  const { elements } = requireMarkup(encodeUtf8(written.xml))
  expect(written.xml).toContain("mc:Ignorable")
  expect(fillValueOf({ element: elements[0]!, children: markupChildren(elements) }, null, true)).toEqual({ gradient })
})
