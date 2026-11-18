import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { readTraits } from "./trait-read.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")

function deck(file: string) {
  return readParts(new Uint8Array(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${file}`)))
}

it("reads a shape whose fill, line, shadow and text colour come from its theme style", async () => {
  const traits = readTraits(await deck("corpus/nasa-class-d-mar.pptx"))
  expect(traits.elements.get(elementId("1192.4"))).toEqual({
    reads: {
      fills: {
        value: {
          gradient: [
            {
              scheme: "accent1",
              transforms: [
                { op: "tint", val: 100_000 },
                { op: "shade", val: 100_000 },
                { op: "satMod", val: 130_000 },
              ],
            },
            {
              scheme: "accent1",
              transforms: [
                { op: "tint", val: 50_000 },
                { op: "shade", val: 100_000 },
                { op: "satMod", val: 350_000 },
              ],
            },
          ],
        },
        source: "style",
      },
      "line.fill": {
        value: {
          color: {
            scheme: "accent1",
            transforms: [
              { op: "shade", val: 95_000 },
              { op: "satMod", val: 105_000 },
            ],
          },
        },
        source: "style",
      },
      "line.width": { value: 9525, source: "style" },
      "effects.shadow": {
        value: {
          blur: 40_000,
          distance: 23_000,
          direction: 5_400_000,
          color: { rgb: "000000", transforms: [{ op: "alpha", val: 35_000 }] },
        },
        source: "style",
      },
      "body.anchor": { value: "ctr" },
      "text.size": { value: 1800, source: "master" },
      "text.color": { value: { scheme: "lt1" }, source: "style" },
      "text.font": { value: "Calibri", source: "style", theme: "minor" },
    },
    kept: [],
  })
})

it("names each placeholder's role and says which of its layout or master shows each value", async () => {
  const traits = readTraits(await deck("corpus/nasa-class-d-mar.pptx"))
  expect(traits.elements.get(elementId("385.3"))).toEqual({
    role: "title",
    reads: {
      "body.anchor": { value: "ctr", source: "master" },
      "body.autofit": { value: "shrink", source: "layout" },
      "text.size": { value: 3600, source: "layout" },
      "text.color": { value: { scheme: "bg1" }, source: "layout" },
      "text.font": { value: "Arial", source: "master" },
      "text.bold": { value: true, source: "master" },
    },
    kept: [],
    placed: { x: 2499544, y: 1461562, cx: 6258941, cy: 1511960 },
  })
  expect(traits.elements.get(elementId("1188.3"))?.role).toBe("body")
  expect(traits.elements.get(elementId("1188.4"))?.role).toBe("number")
  expect(traits.elements.get(elementId("1188.5"))).toEqual({
    reads: {
      geometry: { value: "line" },
      "line.fill": { value: { color: { scheme: "tx1" } } },
      "line.width": { value: 28_575 },
    },
    kept: [],
  })
  expect(traits.palettes).toEqual([
    {
      slots: {
        dk1: "000000",
        lt1: "FFFFFF",
        dk2: "1F497D",
        lt2: "EEECE1",
        accent1: "4F81BD",
        accent2: "C0504D",
        accent3: "9BBB59",
        accent4: "8064A2",
        accent5: "4BACC6",
        accent6: "F79646",
        hlink: "0000FF",
        folHlink: "800080",
      },
      map: { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" },
      fonts: { major: "Calibri", minor: "Calibri" },
    },
  ])
  expect(new Set(traits.slides.values())).toEqual(new Set([0]))
  expect(traits.slides.size).toBe(13)
})

it("keeps a custom geometry and an effect graph out of reach, reads an image fill as fills, and reads a turned, flipped box", async () => {
  const parts = new Map(await deck("blank.pptx"))
  const part = "ppt/slides/slide1.xml"
  const slide = decodeUtf8(parts.get(part)!)
    .replace(
      '<a:xfrm><a:off x="914400" y="1828800"/>',
      '<a:xfrm rot="5400000" flipV="1"><a:off x="914400" y="1828800"/>',
    )
    .replace(
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr anchor="ctr"/>',
      '<a:custGeom><a:pathLst/></a:custGeom><a:blipFill><a:blip/></a:blipFill><a:ln><a:noFill/></a:ln><a:effectDag/></p:spPr><p:txBody><a:bodyPr anchor="ctr"/>',
    )
  parts.set(part, encodeUtf8(slide))
  const title = readTraits(parts).elements.get(elementId("256.2"))
  expect(title).toEqual({
    role: "title",
    reads: {
      geometry: { value: "custom" },
      fills: { value: "image" },
      "box.rot": { value: 5_400_000 },
      "box.flipV": { value: true },
      "body.anchor": { value: "ctr" },
      "text.size": { value: 4400 },
      "text.color": { value: { scheme: "tx1" } },
      "text.font": { value: "Arial", theme: "minor" },
    },
    kept: ["geometry", "effects.shadow", "effects.glow", "effects.softEdge"],
  })
})

it("reads no text body on a picture, table or kept element in a content placeholder, and calls it an object", async () => {
  const traits = readTraits(await deck("doe-heat-pumps.pptx"))
  for (const node of ["2683.8", "2727.6", "2796.7"]) {
    const read = traits.elements.get(elementId(node))
    expect(read?.role).toBe("object")
    expect(Object.keys(read?.reads ?? {}).filter((key) => key.startsWith("body.") || key.startsWith("text."))).toEqual(
      [],
    )
  }
  expect(traits.elements.get(elementId("2775.5"))?.role).toBe("body")
})

it("records the box a placeholder shows from its layout when it has no box of its own", async () => {
  const traits = readTraits(await deck("nasa-1d-cnn.pptx"))
  expect(traits.elements.get(elementId("452.5"))?.placed).toEqual({ x: 1166285, y: 184151, cx: 11025716, cy: 519113 })
  expect(traits.elements.get(elementId("447.5"))).not.toHaveProperty("placed")
})

it("says which theme font a text shows, so a theme font change can name it, and gives each palette its theme's fonts", async () => {
  const traits = readTraits(await deck("doe-heat-pumps.pptx"))
  expect(traits.palettes).toEqual([expect.objectContaining({ fonts: { major: "Calibri Light", minor: "Calibri" } })])
  expect(traits.elements.get(elementId("256.4"))?.reads["text.font"]).toEqual({
    value: "Calibri",
    source: "master",
    theme: "minor",
  })
  expect(traits.elements.get(elementId("256.2"))?.reads["text.font"]).toEqual({ value: "Abadi" })
})
