import {
  decide,
  format,
  openRegister,
  type Alpha,
  type Command,
  type ElementPatch,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { shownFill } from "./fill-read.js"
import { indexPackage } from "./index-package.js"
import { shownLine } from "./line-read.js"
import { readParts } from "./package-container.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readSlides } from "./read-shapes.js"
import { shownAlphas } from "./trait-xml.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

const faded = { set: 60_000 as Alpha }
const opacity: ElementPatch = { fill: { alpha: faded }, line: { alpha: faded }, text: { alpha: faded } }
const shapeOpacity: ElementPatch = { fill: { alpha: faded }, line: { alpha: faded } }
const slidePart = "ppt/slides/slide1.xml"

async function deck(name: string): Promise<Parts> {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)))
}

function edited(parts: Parts, part: string, from: string, to: string): Parts {
  const text = decodeUtf8(parts.get(part)!)
  if (!text.includes(from)) throw new Error(from)
  const next = new Map(parts)
  next.set(part, encodeUtf8(text.replace(from, to)))
  return next
}

function at(parts: Parts, shape: string) {
  const read = readSlides(parts)[0]
  if (read === undefined) throw new Error("slide")
  const element = indexPackage(parts).elements.find((each) => each.node === `${read.slide}.${shape}`)
  if (element === undefined) throw new Error("element")
  return { node: element.node, slide: read.slide, part: read.part, shape }
}

function exported(parts: Parts, shape: string, ...patches: readonly ElementPatch[]): Parts {
  const { node } = at(parts, shape)
  const index = indexPackage(parts)
  const opened: Register = {
    ...openRegister("", "clean"),
    index: { ...index, total: index.elements.length, pages: [] },
  }
  const commands: readonly Command[] = [
    { command: "add", node, floor: "", route: "clean" },
    ...patches.map((patch): Command => ({ command: "person", node, v: format, patch })),
  ]
  const register = commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }, opened)
  return exportParts(parts, register)
}

function slide(parts: Parts): string {
  return decodeUtf8(parts.get(slidePart)!)
}

const styleGradient =
  '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="accent2"><a:lumMod val="75000"/><a:tint val="50000"/><a:satMod val="300000"/><a:alpha val="60000"/></a:schemeClr></a:gs><a:gs pos="35000"><a:schemeClr val="accent2"><a:lumMod val="75000"/><a:tint val="37000"/><a:satMod val="300000"/><a:alpha val="60000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="accent2"><a:lumMod val="75000"/><a:tint val="15000"/><a:satMod val="350000"/><a:alpha val="60000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="1"/></a:gradFill>'

describe("exportParts writes an element's opacity into the alpha of its fill, line and text", () => {
  it("copies a fill and a line from the shape's style as its own, then fades only their colours", async () => {
    const parts = await deck("shapes-added.pptx")
    const before = slide(parts)
    const after = slide(exported(parts, "4", shapeOpacity))
    expect(after).toContain(
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent1"><a:alpha val="60000"/></a:schemeClr></a:solidFill><a:ln><a:solidFill><a:schemeClr val="accent1"><a:shade val="15000"/><a:alpha val="60000"/></a:schemeClr></a:solidFill></a:ln></p:spPr>',
    )
    expect(after.match(/<p:style>.*?<\/p:style>/g)).toEqual(before.match(/<p:style>.*?<\/p:style>/g))
    const written = exported(parts, "4", shapeOpacity)
    expect(shownFill(written, at(parts, "4"))?.own).toBe(true)
    expect(shownLine(written, at(parts, "4"))?.width).toEqual({ value: 12700, own: false })
    expect(shownAlphas(written, at(parts, "4"))).toEqual({ fill: 60_000, line: 60_000, text: null })
  })

  it("copies a gradient style fill byte for byte with the reference colour in place of phClr, and fades every stop", async () => {
    const clean = await deck("clean.pptx")
    const parts = edited(
      clean,
      slidePart,
      '<a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr>',
      '</p:spPr><p:style><a:lnRef idx="0"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="2"><a:schemeClr val="accent2"><a:lumMod val="75000"/></a:schemeClr></a:fillRef><a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></p:style>',
    )
    expect(slide(exported(parts, "2", { fill: { alpha: faded } }))).toContain(
      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${styleGradient}</p:spPr>`,
    )
  })

  it("fades an own fill and every own run colour in place, and adds no line where none shows", async () => {
    const parts = await deck("clean.pptx")
    const after = slide(exported(parts, "2", opacity))
    expect(after).toContain(
      '<a:solidFill><a:schemeClr val="accent1"><a:alpha val="60000"/></a:schemeClr></a:solidFill></p:spPr>',
    )
    expect(after).toContain(
      '<a:rPr lang="en-US" sz="3200"><a:solidFill><a:schemeClr val="dk1"><a:alpha val="60000"/></a:schemeClr></a:solidFill></a:rPr>',
    )
    expect(after).not.toContain("<a:ln")
  })

  it("writes a run's inherited colour with its alpha, and gives a run with no properties its own", async () => {
    const clean = await deck("clean.pptx")
    const inherited = edited(clean, slidePart, '<a:solidFill><a:schemeClr val="dk1"/></a:solidFill>', "")
    expect(slide(exported(inherited, "2", { text: { alpha: faded } }))).toContain(
      '<a:rPr lang="en-US" sz="3200"><a:solidFill><a:schemeClr val="tx1"><a:alpha val="60000"/></a:schemeClr></a:solidFill></a:rPr><a:t>Hello</a:t>',
    )
    const bare = edited(inherited, slidePart, '<a:rPr lang="en-US" sz="3200"></a:rPr>', "")
    expect(slide(exported(bare, "2", { text: { alpha: faded } }))).toContain(
      '<a:r><a:rPr><a:solidFill><a:schemeClr val="tx1"><a:alpha val="60000"/></a:schemeClr></a:solidFill></a:rPr><a:t>Hello</a:t></a:r>',
    )
  })

  it("keeps the alpha a field shows when a new colour replaces it, unless the colour names its own", async () => {
    const parts = exported(await deck("clean.pptx"), "2", opacity)
    const accent2 = { solid: { scheme: "accent2" } } as const
    expect(slide(exported(parts, "2", { fill: { value: { set: accent2 } } }))).toContain(
      '<a:solidFill><a:schemeClr val="accent2"><a:alpha val="60000"/></a:schemeClr></a:solidFill></p:spPr>',
    )
    const own = { solid: { scheme: "accent2", transforms: [{ op: "alpha", val: 20_000 }] } } as const
    expect(slide(exported(parts, "2", { fill: { value: { set: own } } }))).toContain(
      '<a:solidFill><a:schemeClr val="accent2"><a:alpha val="20000"/></a:schemeClr></a:solidFill></p:spPr>',
    )
    const recoloured = exported(parts, "2", { text: { value: { set: "Bye" } } })
    expect(shownAlphas(recoloured, at(parts, "2")).text).toBe(60_000)
  })

  it("writes nothing more when the alpha already shows, and nothing at all for an alpha back to its opening", async () => {
    const parts = await deck("clean.pptx")
    const once = exported(parts, "2", opacity)
    expect(exported(once, "2", opacity).get(slidePart)).toEqual(once.get(slidePart))
    const undone = exported(parts, "2", opacity, {
      fill: { alpha: "opening" },
      line: { alpha: "opening" },
      text: { alpha: "opening" },
    })
    expect(undone.get(slidePart)).toEqual(parts.get(slidePart))
  })

  it("reads Mixed when a field's colours fade differently, and drops the alpha at full opacity", async () => {
    const clean = await deck("clean.pptx")
    const mixed = edited(
      clean,
      slidePart,
      '<a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr>',
      '<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="000000"/></a:gs><a:gs pos="100000"><a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr></a:gs></a:gsLst><a:lin ang="0" scaled="0"/></a:gradFill></p:spPr>',
    )
    expect(shownAlphas(mixed, at(mixed, "2")).fill).toBe("mixed")
    const opaque = slide(exported(mixed, "2", { fill: { alpha: { set: 100_000 as Alpha } } }))
    expect(opaque).toContain('<a:gs pos="100000"><a:srgbClr val="000000"/></a:gs>')
  })
})
