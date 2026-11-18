import {
  changeFills,
  decide,
  elementId,
  format,
  openRegister,
  type Command,
  type ElementId,
  type ElementPatch,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { ownFill } from "./fill-host.js"
import { indexPackage } from "./index-package.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { readSlides } from "./read-shapes.js"
import { shapeById } from "./shape-tree.js"
import { shownSlots } from "./trait-xml-fills.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

const fixtures = `${process.cwd()}/scripts/pptx-fixtures`

const held = [
  ["census-updating-spm.pptx", 1],
  ["doe-heat-pumps.pptx", 3],
  ["nasa-1d-cnn.pptx", 3],
  ["corpus/nasa-earth-gram-rra.pptx", 1],
] as const

const decks = held.map(([name]) => name)

async function deck(name: string): Promise<Parts> {
  return readParts(new Uint8Array(process.getBuiltinModule("node:fs").readFileSync(`${fixtures}/${name}`)))
}

function edited(parts: Parts, node: ElementId, patch: ElementPatch): Parts {
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

function behindOf(parts: Parts) {
  const slides = new Map(readSlides(parts).map((slide) => [slide.slide, slide.part]))
  return indexPackage(parts).elements.flatMap((element) => {
    const [slide = "", shape = ""] = element.node.split(".")
    const part = slides.get(slide)
    if (part === undefined || element.kind !== "shape") return []
    const at = { slide, part, shape }
    const [bottom, top] = shownSlots(parts, at)
    return bottom !== null &&
      bottom !== undefined &&
      "solid" in bottom &&
      top !== undefined &&
      top !== null &&
      "image" in top
      ? [{ node: element.node, at }]
      : []
  })
}

function fillBytes(parts: Parts, at: { readonly part: string; readonly shape: string }): string {
  const bytes = partBytes(parts, at.part)
  const fill = ownFill(bytes, { slide: "", ...at })
  return fill === undefined ? "" : decodeUtf8(bytes.subarray(fill.start, fill.end))
}

describe("a picture with a solid behind its image stays a native p:pic", () => {
  const opened = new Map<string, Parts>()
  const found: { readonly name: string; readonly behind: ReturnType<typeof behindOf> }[] = []

  it("finds the eight slide pictures with a solid behind their image, all in these four decks", async () => {
    for (const name of decks) {
      const parts = await deck(name)
      opened.set(name, parts)
      found.push({ name, behind: behindOf(parts) })
    }
    expect(found.map(({ name, behind }) => [name, behind.length])).toEqual(held)
  })

  it.each(decks)(
    "reads %s's as a solid under an image, keeps them byte for byte, and keeps the solid through a crop",
    (name) => {
      const parts = opened.get(name)
      if (parts === undefined) throw new Error(name)
      expect(exportParts(parts, openRegister("", "clean"))).toBe(parts)
      for (const { node, at } of found.find((each) => each.name === name)?.behind ?? []) {
        const solid = fillBytes(parts, at)
        const after = edited(parts, node, { fills: { crop: { set: { l: 10_000, t: 0, r: 0, b: 0 } } } })
        const picture = shapeById(requireMarkup(partBytes(after, at.part)).elements, at.shape)
        expect(picture.kind, node).toBe("p:pic")
        expect(fillBytes(after, at), node).toBe(solid)
        expect(shownSlots(after, at).slice(0, 2), node).toEqual(shownSlots(parts, at).slice(0, 2))
      }
    },
  )
})

describe("a photo a person switches to a colour, or back to what it inherits", () => {
  it.each([
    ["picture-png.pptx", "256.4", "ppt/slides/slide1.xml"],
    ["doe-heat-pumps.pptx", "2883.13", "ppt/slides/slide9.xml"],
  ])("rewrites %s's p:pic %s as a p:sp that keeps its id, name and alt text", async (name, node, part) => {
    const parts = await deck(name)
    const shape = node.split(".")[1] ?? ""
    const at = { slide: node.split(".")[0] ?? "", part, shape }
    const before = shapeById(requireMarkup(partBytes(parts, part)).elements, shape)
    const identity = decodeUtf8(partBytes(parts, part).subarray(before.start, before.end)).match(/<p:cNvPr[^>]*>/)?.[0]
    const solid = { solid: { scheme: "accent1" } } as const
    const recoloured = edited(parts, elementId(node), { fills: changeFills({ paint: solid }) })
    const after = shapeById(requireMarkup(partBytes(recoloured, part)).elements, shape)
    const xml = decodeUtf8(partBytes(recoloured, part).subarray(after.start, after.end))
    expect(after.kind).toBe("p:sp")
    expect(identity).toBeDefined()
    expect(xml).toContain(identity)
    expect(xml).not.toContain("blipFill")
    expect(shownSlots(recoloured, at)).toEqual([solid, { none: true }, { none: true }, { none: true }])
    const inherited = edited(parts, elementId(node), { fills: changeFills({ paint: null }) })
    const plain = shapeById(requireMarkup(partBytes(inherited, part)).elements, shape)
    expect(plain.kind).toBe("p:sp")
    expect(fillBytes(inherited, at)).toBe("")
  })
})
