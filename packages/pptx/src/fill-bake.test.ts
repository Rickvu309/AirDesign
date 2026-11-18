import { expect, it } from "vitest"
import { bakedFill } from "./fill-bake.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { readSlides } from "./read-shapes.js"
import { stackUri } from "./stack-extension.js"
import { shownSlots } from "./trait-xml-fills.js"
import { writeTrait } from "./trait-xml.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])
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

it("bakes a shape's stacked fills into one image fill and keeps its geometry and style native", async () => {
  const parts = await deck("shapes-added.pptx")
  const at = { slide: "256", part: readSlides(parts)[0]!.part, shape: "4" }
  const stacked = writeTrait(parts, at, "fills", { p1: { set: gradient } })
  const baked = bakedFill(stacked, at, png, "c".repeat(64))
  const xml = decodeUtf8(baked.get(at.part)!)
  const shape = xml.slice(xml.indexOf('<p:cNvPr id="4"'), xml.indexOf("</p:sp>", xml.indexOf('<p:cNvPr id="4"')))
  expect(shape).toContain('<a:blipFill rotWithShape="1"><a:blip')
  expect(shape).not.toContain(stackUri)
  expect(shape).toContain('<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>')
  expect(shape).toContain('<a:lnRef idx="2">')
  expect(shownSlots(baked, at)).toEqual([{ image: true }, { none: true }, { none: true }, { none: true }])
  const media = [...baked.keys()].filter((name) => name.startsWith("ppt/media/picture-"))
  expect(media.map((name) => baked.get(name))).toEqual([png])
})

it("bakes a photo's stacked fills into its own p:pic blip and drops the fill behind", async () => {
  const parts = await deck("picture-png.pptx")
  const at = { slide: "256", part: "ppt/slides/slide1.xml", shape: "4" }
  const stacked = writeTrait(parts, at, "fills", { p1: { set: gradient } })
  const xml = decodeUtf8(bakedFill(stacked, at, png, "d".repeat(64)).get(at.part)!)
  expect(xml).toContain("<p:pic>")
  expect(xml).not.toContain(stackUri)
  expect(xml).toContain('<a:blip r:embed="rId3"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>')
})
