import { expect, it } from "vitest"
import { stackUri } from "./stack-extension.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { paintReader } from "./paint-reader.js"
import { shownSlots } from "./trait-xml-fills.js"
import { writeTrait } from "./trait-xml.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const none = { none: true } as const
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

async function deck(name: string) {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)))
}

it("writes a gradient over a shape's colour as the colour natively and the two paints in its extension", async () => {
  const parts = await deck("shapes-added.pptx")
  const at = { slide: "256", part: "ppt/slides/slide1.xml", shape: "4" }
  const [bottom] = shownSlots(parts, at)
  const stacked = writeTrait(parts, at, "fills", { p1: { set: gradient } })
  expect(shownSlots(stacked, at)).toEqual([bottom, gradient, none, none])
  expect(decodeUtf8(stacked.get(at.part)!)).toContain(stackUri)
  const back = writeTrait(stacked, at, "fills", { p1: { set: none } })
  expect(shownSlots(back, at)).toEqual([bottom, none, none, none])
  expect(decodeUtf8(back.get(at.part)!)).not.toContain(stackUri)
})

it("keeps a photo's p:pic and its image, and lists a gradient above the image in the extension", async () => {
  const parts = await deck("picture-png.pptx")
  const at = { slide: "256", part: "ppt/slides/slide1.xml", shape: "4" }
  const stacked = writeTrait(parts, at, "fills", { p1: { set: gradient } })
  const xml = decodeUtf8(stacked.get(at.part)!)
  expect(xml).toContain("<p:pic>")
  expect(xml).toContain('<a:blip r:embed="rId2"/>')
  expect(shownSlots(stacked, at)).toEqual([{ image: true }, gradient, none, none])
  expect(writeTrait(stacked, at, "fills", { p1: { set: none } }).get(at.part)).toEqual(parts.get(at.part))
})

it("reads a stack for painting, bottom first, with the layer's image as one of its paints", async () => {
  const photo = await deck("picture-png.pptx")
  const at = { slide: "256", part: "ppt/slides/slide1.xml", shape: "4" }
  const stacked = writeTrait(photo, at, "fills", { p1: { set: gradient } })
  const painted = paintReader(stacked)
    .slide(at.part)
    .elements.find((element) => element.shape === "4")
  expect(painted?.stack?.map((paint) => paint.type)).toEqual(["image", "gradient"])
  expect(painted?.image?.part).toBe("ppt/media/picture-008753c5d40023df.png")
  const plain = paintReader(photo)
    .slide(at.part)
    .elements.find((element) => element.shape === "4")
  expect(plain?.stack).toBeUndefined()
})
