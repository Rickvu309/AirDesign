import { expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { paintReader } from "./paint-reader.js"
import { shownSlots } from "./trait-xml-fills.js"
import { writeTrait } from "./trait-xml.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const none = { none: true } as const
const black = { solid: { rgb: "000000", transforms: [{ op: "alpha", val: 50_000 }] } } as const
const gradient = {
  gradient: {
    stops: [
      { pos: 0, color: { scheme: "accent2", transforms: [{ op: "alpha", val: 0 }] } },
      { pos: 100_000, color: { scheme: "accent2" } },
    ],
    shade: { linear: { angle: 5_400_000, scaled: false } },
    rotateWithShape: true,
  },
} as const
const photo = { slide: "256", part: "ppt/slides/slide1.xml", shape: "4" }

async function deck(name: string) {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)))
}

function overlaid(parts: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> {
  const xml = decodeUtf8(parts.get(photo.part)!).replace(
    '<a:blip r:embed="rId2"/>',
    '<a:blip r:embed="rId2"><a:fillOverlay blend="over"><a:solidFill><a:srgbClr val="000000"><a:alpha val="50000"/></a:srgbClr></a:solidFill></a:fillOverlay></a:blip>',
  )
  return new Map([...parts, [photo.part, encodeUtf8(xml)]])
}

it("reads an image's own overlay as the top paint, keeps it untouched, and moves it into the list once the list changes", async () => {
  const parts = overlaid(await deck("picture-png.pptx"))
  expect(shownSlots(parts, photo)).toEqual([{ image: true }, none, none, black])
  expect(writeTrait(parts, photo, "fills", { p3: { set: black } })).toBe(parts)
  const stacked = writeTrait(parts, photo, "fills", { p1: { set: gradient } })
  const xml = decodeUtf8(stacked.get(photo.part)!)
  expect(xml).not.toContain("a:fillOverlay")
  expect(shownSlots(stacked, photo)).toEqual([{ image: true }, gradient, none, black])
  const painted = paintReader(stacked)
    .slide(photo.part)
    .elements.find((element) => element.shape === "4")
  expect(painted?.stack?.map((paint) => paint.type)).toEqual(["image", "gradient", "solid"])
})
