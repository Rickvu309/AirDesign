import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { markBar, markStem } from "./airdesign-mark-art"

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")
const strokesOf = (svg: string) => [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((match) => match[1])

it("draws the site mark and favicon at the logo's weight, the same strokes as the studio icon", () => {
  expect([markStem, markBar]).toEqual(strokesOf(read("../../../web/public/favicon-art.svg")))
  expect([markStem, markBar]).toEqual(strokesOf(read("../../public/favicon-art.svg")))
})

it("draws the mark in the landing demo at the logo's weight for its 16.98 px size", () => {
  const demo = read("../landing/product-demo/editor-demo-art.html")
  const stem = demo.match(/d="M3\.45,15\.12 L8\.49,1\.86 L13\.53,15\.12"[^>]*stroke-width="([\d.]+)"/)?.[1]
  const bar = demo.match(/x1="1\.6" y1="11\.67" x2="15\.39" y2="7\.96"[^>]*stroke-width="([\d.]+)"/)?.[1]
  const scale = 16.98 / 64
  expect(Number(stem)).toBeCloseTo(Number(markStem) * scale, 2)
  expect(Number(bar)).toBeCloseTo(Number(markBar) * scale, 2)
})
