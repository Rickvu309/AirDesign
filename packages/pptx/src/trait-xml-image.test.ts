import {
  decide,
  elementId,
  format,
  openRegister,
  slideId,
  type Command,
  type ElementPatch,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"
import { shownImage } from "./picture-read.js"
import { iconOfPart, iconParts, unheldIcons, withMedia } from "./picture-write.js"
import { readSlides } from "./read-shapes.js"
import { freeShapeId } from "./shape-id.js"
import { orderedParts } from "./slide-order-route.js"
import { readTraits } from "./trait-read.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

async function deck(name: string): Promise<Parts> {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)))
}

function at(parts: Parts, slide: string, shape: string) {
  const part = readSlides(parts).find((each) => each.slide === slide)?.part
  if (part === undefined) throw new Error("slide")
  const element = indexPackage(parts).elements.find((each) => each.node === `${slide}.${shape}`)
  if (element === undefined) throw new Error("element")
  return { node: element.node, slide, part, shape }
}

function exported(parts: Parts, node: ReturnType<typeof at>["node"], patch: ElementPatch): Parts {
  const index = indexPackage(parts)
  const opened: Register = {
    ...openRegister("", "clean"),
    index: { ...index, total: index.elements.length, pages: [] },
  }
  const commands: readonly Command[] = [
    { command: "add", node, floor: "", route: "clean" },
    { command: "person", node, v: format, patch },
  ]
  const register = commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }, opened)
  return exportParts(parts, register)
}

function text(parts: Parts, part: string): string {
  return decodeUtf8(parts.get(part)!)
}

function changed(before: Parts, after: Parts): readonly string[] {
  return [...new Set([...before.keys(), ...after.keys()])].filter((name) => {
    const left = before.get(name)
    const right = after.get(name)
    return left === undefined || right === undefined || !sameBytes(left, right)
  })
}

const rocket = iconParts("rocket")

describe("an icon's weight is the line width its SVG and PNG are drawn at", () => {
  it("links the weighted icon's own parts, reads the weight back, keeps it through a swap, and Lucide's 2 is the plain parts", async () => {
    const parts = await deck("doe-heat-pumps.pptx")
    const picture = at(parts, "2883", "13")
    const rels = "ppt/slides/_rels/slide9.xml.rels"
    const plain = exported(parts, picture.node, { fills: { source: { set: "rocket" } } })
    expect(shownImage(plain, picture)?.weight).toBe(200)
    const light = exported(parts, picture.node, { fills: { source: { set: "rocket" }, weight: { set: 150 } } })
    const thin = iconParts("rocket", 150)
    expect(thin).toEqual({ svg: "ppt/media/icon-rocket.w150.svg", png: "ppt/media/icon-rocket.w150.png" })
    expect(text(light, rels)).toContain('Target="../media/icon-rocket.w150.png"/>')
    expect(text(light, rels)).toContain('Target="../media/icon-rocket.w150.svg"/>')
    expect(shownImage(light, picture)).toMatchObject({ source: "rocket", weight: 150 })
    expect(readTraits(light).elements.get(picture.node)?.reads["fills.weight"]).toEqual({ value: 150 })
    const painted = paintReader(light)
      .slide(picture.part)
      .elements.find((each) => each.shape === "13")
    expect(painted?.image).toMatchObject({ part: thin.svg, contentType: "image/svg+xml" })
    expect(unheldIcons(light)).toContainEqual({ name: "rocket", weight: 150, color: { hex: "000000" } })
    const held = withMedia(light, (part) => (part === thin.svg || part === thin.png ? encodeUtf8("<svg/>") : undefined))
    expect(unheldIcons(held)).not.toContainEqual({ name: "rocket", weight: 150, color: { hex: "000000" } })
    const swapped = exported(light, picture.node, { fills: { source: { set: "star" } } })
    expect(shownImage(swapped, picture)).toMatchObject({ source: "star", weight: 150 })
    expect(text(swapped, rels)).toContain('Target="../media/icon-star.w150.svg"/>')
    const lucide = exported(light, picture.node, { fills: { weight: { set: 200 } } })
    expect(shownImage(lucide, picture)).toMatchObject({ source: "rocket", weight: 200 })
    const repainted = paintReader(lucide)
      .slide(picture.part)
      .elements.find((each) => each.shape === "13")
    expect(repainted?.image).toMatchObject({ part: rocket.svg })
    expect(readTraits(plain).elements.get(picture.node)?.reads["fills.weight"]).toBeUndefined()
  })

  it("leaves a photo alone, since only an icon has lines to weigh", async () => {
    const parts = await deck("doe-heat-pumps.pptx")
    const picture = at(parts, "2883", "13")
    expect(shownImage(parts, picture)?.weight).toBeNull()
    expect(changed(parts, exported(parts, picture.node, { fills: { weight: { set: 150 } } }))).toEqual([])
  })
})

describe("an icon's color is the color its SVG and PNG are drawn in", () => {
  it("draws a template color as the slide template's hex, keeps the slot in the part name, and keeps both through a swap and a weight", async () => {
    const parts = await deck("doe-heat-pumps.pptx")
    const picture = at(parts, "2883", "13")
    const plain = exported(parts, picture.node, { fills: { source: { set: "rocket" } } })
    expect(shownImage(plain, picture)?.color).toEqual({ rgb: "000000" })
    expect(readTraits(plain).elements.get(picture.node)?.reads["fills.color"]).toBeUndefined()
    const accent = exported(parts, picture.node, {
      fills: { source: { set: "rocket" }, weight: { set: 150 }, color: { set: { scheme: "accent1" } } },
    })
    const blue = { hex: "4472C4", scheme: "accent1" } as const
    expect(iconParts("rocket", 150, blue).svg).toBe("ppt/media/icon-rocket.w150.c4472C4.accent1.svg")
    expect(shownImage(accent, picture)).toMatchObject({ source: "rocket", weight: 150, color: { scheme: "accent1" } })
    expect(readTraits(accent).elements.get(picture.node)?.reads["fills.color"]).toEqual({
      value: { scheme: "accent1" },
    })
    const painted = paintReader(accent)
      .slide(picture.part)
      .elements.find((each) => each.shape === "13")
    expect(painted?.image).toMatchObject({ part: iconParts("rocket", 150, blue).svg })
    expect(unheldIcons(accent)).toContainEqual({ name: "rocket", weight: 150, color: blue })
    const star = exported(accent, picture.node, { fills: { source: { set: "star" } } })
    expect(shownImage(star, picture)).toMatchObject({ source: "star", weight: 150, color: { scheme: "accent1" } })
    const heavier = exported(accent, picture.node, { fills: { weight: { set: 250 } } })
    expect(shownImage(heavier, picture)).toMatchObject({ weight: 250, color: { scheme: "accent1" } })
  })

  it("draws a hex as itself, and a tinted template color as its hex with the slot and tint in the name", async () => {
    const parts = await deck("doe-heat-pumps.pptx")
    const picture = at(parts, "2883", "13")
    const navy = exported(parts, picture.node, {
      fills: { source: { set: "rocket" }, color: { set: { rgb: "1F4E79" } } },
    })
    expect(text(navy, "ppt/slides/_rels/slide9.xml.rels")).toContain('Target="../media/icon-rocket.c1F4E79.svg"/>')
    expect(shownImage(navy, picture)?.color).toEqual({ rgb: "1F4E79" })
    const tinted = exported(parts, picture.node, {
      fills: {
        source: { set: "rocket" },
        color: { set: { scheme: "accent1", transforms: [{ op: "lumMod", val: 50_000 }] } },
      },
    })
    const half = { scheme: "accent1", transforms: [{ op: "lumMod", val: 50_000 }] }
    expect(shownImage(tinted, picture)?.color).toEqual(half)
    expect(text(tinted, "ppt/slides/_rels/slide9.xml.rels")).toContain(
      'Target="../media/icon-rocket.c203864.accent1.lumMod50000.svg"/>',
    )
    const faded = exported(parts, picture.node, {
      fills: {
        source: { set: "rocket" },
        color: { set: { scheme: "accent1", transforms: [{ op: "alpha", val: 50_000 }] } },
      },
    })
    expect(shownImage(faded, picture)?.color).toEqual({ scheme: "accent1" })
  })

  it("names black with no template slot by the plain parts, so older decks keep their bytes", () => {
    expect(iconParts("rocket", 200, { hex: "000000" })).toEqual(iconParts("rocket"))
    expect(iconOfPart("ppt/media/icon-rocket.svg")).toEqual({ name: "rocket", weight: 200, color: { hex: "000000" } })
    expect(iconOfPart("ppt/media/icon-rocket.c000000.svg")).toBeNull()
    expect(iconOfPart("ppt/media/icon-rocket.c000000.tx1.svg")).toEqual({
      name: "rocket",
      weight: 200,
      color: { hex: "000000", scheme: "tx1" },
    })
    expect(iconOfPart("ppt/media/icon-rocket.c4472c4.svg")).toBeNull()
    expect(iconOfPart("ppt/media/icon-rocket.c4472C4.plum.svg")).toBeNull()
    expect(iconOfPart("ppt/media/icon-rocket.c6F9BD9.accent1.lumMod60000.lumOff40000.svg")).toEqual({
      name: "rocket",
      weight: 200,
      color: {
        hex: "6F9BD9",
        scheme: "accent1",
        transforms: [
          { op: "lumMod", val: 60_000 },
          { op: "lumOff", val: 40_000 },
        ],
      },
    })
    expect(iconOfPart("ppt/media/icon-rocket.c6F9BD9.accent1.glow5.svg")).toBeNull()
  })
})

describe("an icon added with a color in its opening", () => {
  it("draws the new icon in the template's text color, kept as the slot", async () => {
    const parts = await deck("clean.pptx")
    const slide = readSlides(parts)[0]!
    const id = slideId(slide.slide)
    const node = elementId(`${slide.slide}.${String(freeShapeId(parts, slide.part))}`)
    const opening = {
      fills: { p0: { set: { image: true } }, source: { set: "rocket" }, color: { set: { scheme: "tx1" } } },
    } as const
    const element = {
      node,
      kind: "shape",
      value: null,
      box: { x: 0, y: 0, cx: 914_400, cy: 914_400 },
      grouped: false,
      opening,
    } as const
    const register = {
      ...openRegister("", "clean"),
      file: [id],
      order: [{ slide: "element-add", id, element }],
    } as const
    const added = exportParts(orderedParts(parts, register), register)
    const placed = { slide: slide.slide, part: slide.part, shape: node.split(".")[1]! }
    expect(shownImage(added, placed)).toMatchObject({ source: "rocket", color: { scheme: "tx1" } })
  })
})
