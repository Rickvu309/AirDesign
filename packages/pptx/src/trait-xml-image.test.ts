import { decide, format, openRegister, type Command, type ElementPatch, type Register } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"
import { shownImage } from "./picture-read.js"
import { iconParts, unheldIcons, withMedia } from "./picture-write.js"
import { readSlides } from "./read-shapes.js"
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
    expect(unheldIcons(light)).toContainEqual({ name: "rocket", weight: 150 })
    const held = withMedia(light, (part) => (part === thin.svg || part === thin.png ? encodeUtf8("<svg/>") : undefined))
    expect(unheldIcons(held)).not.toContainEqual({ name: "rocket", weight: 150 })
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
