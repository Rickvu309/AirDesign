import { decide, format, openRegister, type Command, type ElementPatch, type Register } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { shownEffects } from "./effects-read.js"
import { exportParts } from "./export-parts.js"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"
import { readSlides } from "./read-shapes.js"
import { readTraits } from "./trait-read.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

const accent1Glow = { scheme: "accent1", transforms: [{ op: "alpha", val: 60000 }] } as const
const glow: ElementPatch = { effects: { glow: { set: { halo: { radius: 101600, color: accent1Glow } } } } }
const styleShadow =
  '<a:outerShdw blurRad="40000" dist="23000" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr></a:outerShdw>'
const glowXml = '<a:glow rad="101600"><a:schemeClr val="accent1"><a:alpha val="60000"/></a:schemeClr></a:glow>'

async function deck(name: string): Promise<Parts> {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)))
}

function at(parts: Parts, slide: number, shape: string) {
  const read = readSlides(parts)[slide - 1]
  if (read === undefined) throw new Error("slide")
  const element = indexPackage(parts).elements.find((each) => each.node === `${read.slide}.${shape}`)
  if (element === undefined) throw new Error("element")
  return { node: element.node, part: read.part, shape }
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
  return [...after]
    .filter(([name, bytes]) => {
      const old = before.get(name)
      return old === undefined || old.length !== bytes.length || old.some((byte, index) => byte !== bytes[index])
    })
    .map(([name]) => name)
}

function withPart(parts: Parts, part: string, edit: (text: string) => string): Parts {
  const next = new Map(parts)
  next.set(part, encodeUtf8(edit(text(parts, part))))
  return next
}

describe("exportParts on effects", () => {
  it("copies the style's effect list byte for byte before it adds glow, so the shadow keeps its alpha and rotWithShape", async () => {
    const parts = await deck("corpus/nasa-class-d-mar.pptx")
    const shape = at(parts, 5, "4")
    expect(shownEffects(parts, shape)?.shadow).toEqual({
      value: {
        outer: {
          blur: 40000,
          distance: 23000,
          direction: 5400000,
          color: { rgb: "000000", transforms: [{ op: "alpha", val: 35000 }] },
        },
      },
      own: false,
    })
    const after = exported(parts, shape.node, glow)
    const slide = text(after, shape.part)
    expect(slide).toContain(
      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:effectLst>${glowXml}${styleShadow}</a:effectLst></p:spPr><p:style>`,
    )
    expect(slide.match(/<p:style>.*?<\/p:style>/gs)).toEqual(text(parts, shape.part).match(/<p:style>.*?<\/p:style>/gs))
    expect(changed(parts, after)).toEqual([shape.part])
    expect(shownEffects(after, shape)?.glow).toEqual({
      value: { halo: { radius: 101600, color: accent1Glow } },
      own: true,
    })
    const painted = paintReader(after)
      .slide(shape.part)
      .elements.find((each) => each.from === "slide" && each.shape === "4")
    expect(painted?.effects?.glow?.radius).toBe(101600)
    expect(painted?.effects?.shadow?.blur).toBe(40000)
  })

  it("keeps algn, rotWithShape and the alpha of a style shadow when it copies the list", async () => {
    const original = await deck("corpus/nasa-earth-gram-rra.pptx")
    const found = indexPackage(original).elements.find((each) => each.kind === "shape" && !each.grouped)
    const slides = readSlides(original)
    const first = slides.find((each) => text(original, each.part).includes('<a:effectRef idx="1">'))
    if (found === undefined || first === undefined) throw new Error("no style effect")
    const parts = withPart(original, first.part, (xml) => xml.replace('<a:effectRef idx="1">', '<a:effectRef idx="3">'))
    const source = text(parts, first.part)
    const shapeId = /<p:cNvPr id="(\d+)"[^>]*>(?:(?!<p:cNvPr ).)*?<a:effectRef idx="3">/s.exec(source)?.[1]
    if (shapeId === undefined) throw new Error("no shape")
    const shape = at(parts, slides.indexOf(first) + 1, shapeId)
    const after = text(exported(parts, shape.node, glow), shape.part)
    const theme = decodeUtf8(parts.get("ppt/theme/theme1.xml")!)
    const third = [...theme.matchAll(/<a:effectStyle>(.*?)<\/a:effectStyle>/gs)][2]?.[1] ?? ""
    const shadow = /<a:outerShdw .*?<\/a:outerShdw>/s.exec(third)?.[0] ?? "missing"
    expect(shadow).toContain('algn="ctr"')
    expect(shadow).toContain('rotWithShape="0"')
    expect(shadow).toContain("<a:alpha ")
    expect(after).toContain(`<a:effectLst>${glowXml}${shadow}</a:effectLst>`)
  })

  it("patches only the shadow's blur, distance, direction and colour, and keeps every other attribute", async () => {
    const parts = await deck("corpus/nasa-class-d-mar.pptx")
    const shape = at(parts, 5, "4")
    const copied = exported(parts, shape.node, glow)
    const own = withPart(copied, shape.part, (xml) =>
      xml.replace('rotWithShape="0">', 'algn="ctr" sx="90000" rotWithShape="0">'),
    )
    const after = text(
      exported(own, shape.node, {
        effects: {
          shadow: {
            set: { outer: { blur: 63500, distance: 38100, direction: 2700000, color: { scheme: "tx1" } } },
          },
        },
      }),
      shape.part,
    )
    expect(after).toContain(
      `${glowXml}<a:outerShdw blurRad="63500" dist="38100" dir="2700000" algn="ctr" sx="90000" rotWithShape="0"><a:schemeClr val="tx1"/></a:outerShdw></a:effectLst>`,
    )
  })

  it("writes an own empty list when a person takes away the style's only shadow", async () => {
    const parts = await deck("corpus/nasa-class-d-mar.pptx")
    const shape = at(parts, 5, "4")
    const after = exported(parts, shape.node, { effects: { shadow: { set: { none: true } } } })
    expect(text(after, shape.part)).toContain('<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:effectLst/></p:spPr>')
    expect(shownEffects(after, shape)?.shadow).toEqual({ value: { none: true }, own: true })
  })

  it("adds a shadow and a soft edge at their schema places in a shape with no effects", async () => {
    const parts = await deck("clean.pptx")
    const shape = at(parts, 1, "2")
    const after = exported(parts, shape.node, {
      effects: {
        softEdge: { set: { radius: 63500 } },
        shadow: { set: { outer: { blur: 50800, distance: 38100, direction: 2700000, color: { rgb: "000000" } } } },
      },
    })
    expect(text(after, shape.part)).toContain(
      '<a:effectLst><a:outerShdw blurRad="50800" dist="38100" dir="2700000" rotWithShape="0"><a:srgbClr val="000000"/></a:outerShdw><a:softEdge rad="63500"/></a:effectLst>',
    )
    expect(shownEffects(after, shape)?.softEdge).toEqual({ value: { radius: 63500 }, own: true })
  })

  it("writes a group's effects into its group properties", async () => {
    const parts = await deck("doe-heat-pumps.pptx")
    const group = indexPackage(parts).elements.find((each) => each.kind === "group" && !each.grouped)
    if (group === undefined) throw new Error("no group")
    const [slideId = "", shapeId = ""] = group.node.split(".")
    const slide = readSlides(parts).findIndex((each) => each.slide === slideId)
    const shape = at(parts, slide + 1, shapeId)
    const after = text(exported(parts, shape.node, glow), shape.part)
    expect(after).toMatch(new RegExp(`<p:grpSpPr>(?:(?!</p:grpSpPr>).)*<a:effectLst>${glowXml}</a:effectLst>`, "s"))
  })

  it("reads an own effect DAG as kept, so a patch inside it is refused", async () => {
    const original = await deck("clean.pptx")
    const read = readSlides(original)[0]!
    const parts = withPart(original, read.part, (xml) =>
      xml.replace(
        /<p:spPr>(.*?)<\/p:spPr>/s,
        '<p:spPr>$1<a:effectDag type="sib"><a:glow rad="1"/></a:effectDag></p:spPr>',
      ),
    )
    const shape = indexPackage(parts).elements.find(
      (each) => each.node.startsWith(`${read.slide}.`) && each.kind === "shape",
    )
    expect(readTraits(parts).elements.get(shape!.node)?.kept).toEqual(
      expect.arrayContaining(["effects.shadow", "effects.glow", "effects.softEdge"]),
    )
  })
})
