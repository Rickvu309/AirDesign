declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import { readColor, slideId, type Color, type TextValue } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { colorXml, solidFillXml } from "./color-xml.js"
import { markupDocument } from "./element-span.js"
import { orderedParts, paintReader, readParts, readSlides } from "./index.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { applyRoute } from "./slide-route.js"

const { readFileSync } = process.getBuiltinModule("node:fs")
const fixture = (name: string) => readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))
const darker: Color = { scheme: "accent1", transforms: [{ op: "lumMod", val: 75000 }] }
const bases = { "a:schemeClr": "scheme", "a:srgbClr": "rgb", "a:prstClr": "preset" } as const

function readBack(xml: string): unknown {
  const { elements } = markupDocument(encodeUtf8(xml))
  const [root, ...children] = elements
  if (root === undefined) return null
  const value = (element: (typeof elements)[number], name: string) =>
    element.attributes.find((attribute) => attribute.name === name)?.value
  const transforms = children.map((child) => {
    const val = value(child, "val")
    return val === undefined ? { op: child.kind.slice(2) } : { op: child.kind.slice(2), val: Number(val) }
  })
  const base =
    root.kind === "a:sysClr"
      ? { system: value(root, "val"), last: value(root, "lastClr") }
      : { [bases[root.kind as keyof typeof bases]]: value(root, "val") }
  return readColor(transforms.length === 0 ? base : { ...base, transforms })
}

describe("colorXml", () => {
  it.each<[Color, string]>([
    [{ scheme: "accent1" }, '<a:schemeClr val="accent1"/>'],
    [{ scheme: "tx1" }, '<a:schemeClr val="tx1"/>'],
    [{ rgb: "1F4E79" }, '<a:srgbClr val="1F4E79"/>'],
    [{ system: "windowText", last: "000000" }, '<a:sysClr val="windowText" lastClr="000000"/>'],
    [{ preset: "black" }, '<a:prstClr val="black"/>'],
    [darker, '<a:schemeClr val="accent1"><a:lumMod val="75000"/></a:schemeClr>'],
    [
      { rgb: "000000", transforms: [{ op: "alpha", val: 35000 }, { op: "comp" }] },
      '<a:srgbClr val="000000"><a:alpha val="35000"/><a:comp/></a:srgbClr>',
    ],
  ])("writes %j", (color, xml) => {
    expect(colorXml(color)).toBe(xml)
    expect(solidFillXml(color)).toBe(`<a:solidFill>${xml}</a:solidFill>`)
  })

  const every: Color = {
    scheme: "bg2",
    transforms: [
      { op: "alpha", val: 35000 },
      { op: "alphaMod", val: 50000 },
      { op: "alphaOff", val: -10000 },
      { op: "tint", val: 40000 },
      { op: "shade", val: 60000 },
      { op: "lum", val: 20000 },
      { op: "lumMod", val: 75000 },
      { op: "lumOff", val: 25000 },
      { op: "sat", val: 30000 },
      { op: "satMod", val: 120000 },
      { op: "satOff", val: -5000 },
      { op: "hue", val: 5400000 },
      { op: "hueMod", val: 50000 },
      { op: "hueOff", val: -60000 },
      { op: "red", val: 1 },
      { op: "redMod", val: 2 },
      { op: "redOff", val: 3 },
      { op: "green", val: 4 },
      { op: "greenMod", val: 5 },
      { op: "greenOff", val: 6 },
      { op: "blue", val: 7 },
      { op: "blueMod", val: 8 },
      { op: "blueOff", val: 9 },
      { op: "comp" },
      { op: "inv" },
      { op: "gray" },
      { op: "gamma" },
      { op: "invGamma" },
    ],
  }

  it.each<Color>([
    every,
    { rgb: "336699", transforms: [...(every.transforms ?? [])].reverse() },
    { system: "window", last: "FFFFFF", transforms: [{ op: "shade", val: 95000 }] },
    { preset: "dkSlateBlue", transforms: [{ op: "lumMod", val: 50000 }] },
  ])("reads back the colour it wrote, every transform in order: %j", (color) => {
    expect(readBack(colorXml(color))).toEqual(color)
  })
})

describe("the writers keep a theme colour's transforms", () => {
  it("writes a run's theme colour with lumMod into its run properties", () => {
    const part = "ppt/slides/slide1.xml"
    const slide = (body: string) =>
      `<p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:bodyPr/>${body}</p:txBody></p:sp></p:spTree>`
    const before = '<a:p><a:r><a:rPr lang="en-US"/><a:t>Hello</a:t></a:r></a:p>'
    const value: TextValue = [{ from: 0, runs: [{ from: 0, text: "Hello", color: darker }] }]
    const after = applyRoute(new Map([[part, encodeUtf8(slide(before))]]), { name: "text", part, shape: "2", value })
    expect(decodeUtf8(after.get(part)!)).toBe(
      slide(
        '<a:p><a:r><a:rPr lang="en-US"><a:solidFill><a:schemeClr val="accent1"><a:lumMod val="75000"/></a:schemeClr></a:solidFill></a:rPr><a:t>Hello</a:t></a:r></a:p>',
      ),
    )
  })

  it("writes a slide background's theme colour with lumMod, and paints it darker than the slot", async () => {
    const parts = await fixture("blank.pptx")
    const [first] = readSlides(parts)
    if (first === undefined) throw new Error("slide")
    const id = slideId(first.slide)
    const state = (color: Color) => ({ file: [id], order: [{ slide: "background" as const, id, color }] })
    const next = orderedParts(parts, state(darker))
    expect(decodeUtf8(next.get(first.part)!)).toContain(
      '<p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="accent1"><a:lumMod val="75000"/></a:schemeClr></a:solidFill><a:effectLst/></p:bgPr></p:bg>',
    )
    const slot = paintReader(orderedParts(parts, state({ scheme: "accent1" }))).slide(first.part).background
    expect(slot).toEqual({ type: "solid", color: { hex: "505050", alpha: 1 } })
    expect(paintReader(next).slide(first.part).background).toEqual({
      type: "solid",
      color: { hex: "3C3C3C", alpha: 1 },
    })
  })

  it("writes a shape's fill through the same codec", () => {
    const part = "ppt/slides/slide1.xml"
    const slide = (properties: string) =>
      `<p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr>${properties}</p:sp></p:spTree>`
    const after = applyRoute(new Map([[part, encodeUtf8(slide("<p:spPr/>"))]]), {
      name: "spPr.fill",
      part,
      shape: "2",
      value: { kind: "theme", value: "accent1" },
    })
    expect(decodeUtf8(after.get(part)!)).toBe(slide(`<p:spPr>${solidFillXml({ scheme: "accent1" })}</p:spPr>`))
  })
})
