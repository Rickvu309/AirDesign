import {
  cloneOf,
  decide,
  elementId,
  maskTurn,
  openRegister,
  slideId,
  type Command,
  type ElementId,
  type Media,
  type Register,
  type SlideCommand,
} from "@airdesign/document"
import { orderKeyBetween } from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readShapes } from "./read-shapes.js"
import { newDuplicateShapeIds, shapeIdCounts } from "./shape-id.js"
import { orderedParts } from "./slide-order-route.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

const first = slideId("256")
const added = slideId("257")
const picture = elementId("256.4")
const pasted = elementId("257.9")
const at = { x: 100000, y: 200000, cx: 4572000, cy: 3048000 }
const firstPart = "ppt/slides/slide1.xml"
const media = "ppt/media/picture-008753c5d40023df.png"

async function fixture(name: string): Promise<Parts> {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)))
}

function opened(parts: Parts): Register {
  const index = indexPackage(parts)
  return { ...openRegister("", "picture"), index: { ...index, total: index.elements.length, pages: [] } }
}

function landed(register: Register, edits: readonly SlideCommand[]): Register {
  return edits.reduce((current, edit) => {
    const command: Command = { command: "slide", file: [first], edit }
    const decision = decide(current, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }, register)
}

const newSlide: SlideCommand = {
  slide: "add",
  id: added,
  after: first,
  key: orderKeyBetween(orderKeyBetween(null, null), null),
  layout: first,
}

function exported(parts: Parts, register: Register): Parts {
  return exportParts(orderedParts(parts, register), register)
}

function partOfSlide(parts: Parts, slide: string): string {
  const found = readShapes(parts).find((shape) => shape.slide === slide)
  if (found === undefined) throw new Error(slide)
  return found.part
}

function pastedOnto(parts: Parts, edits: readonly SlideCommand[] = []): { register: Register; after: Parts } {
  const blank = landed(opened(parts), [newSlide, ...edits])
  const made = cloneOf(blank, picture, pasted, at)
  if (!made.ok) throw new Error(made.refusal)
  const register = landed(blank, [made.command])
  return { register, after: exported(parts, register) }
}

describe("element paste export", () => {
  it("writes a picture pasted onto another slide with its own id, its own link to the same image and its box", async () => {
    const parts = await fixture("picture-png.pptx")
    const without = exported(parts, landed(opened(parts), [newSlide]))
    const { after } = pastedOnto(parts)
    const part = partOfSlide(after, "257")
    const shapes = readShapes(after).filter((shape) => shape.slide === "257")
    expect(shapes.map((shape) => [shape.shape, shape.box])).toContainEqual(["9", expect.objectContaining(at)])
    const xml = decodeUtf8(after.get(part)!)
    const embed = /<p:cNvPr id="9"[\s\S]*?r:embed="(rId[0-9]+)"/.exec(xml)?.[1]
    const rels = decodeUtf8(after.get(part.replace("slides/", "slides/_rels/") + ".rels")!)
    expect(rels).toContain(
      `Id="${embed ?? ""}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/picture-008753c5d40023df.png"`,
    )
    expect(after.get(media)).toEqual(parts.get(media))
    expect(newDuplicateShapeIds(shapeIdCounts(without), shapeIdCounts(after))).toEqual([])
    const changed = [part, part.replace("slides/", "slides/_rels/") + ".rels"]
    for (const [name, bytes] of without) if (!changed.includes(name)) expect(after.get(name), name).toEqual(bytes)
  })

  it("keeps a pasted picture and its image after its source is cut", async () => {
    const parts = await fixture("picture-png.pptx")
    const { register } = pastedOnto(parts)
    const cut = landed(register, [{ slide: "element-remove", id: first, node: picture }])
    const after = exported(parts, cut)
    expect(
      readShapes(after)
        .filter((shape) => shape.part === firstPart)
        .map((shape) => shape.shape),
    ).toEqual(["2", "3"])
    expect(
      readShapes(after)
        .filter((shape) => shape.slide === "257")
        .map((shape) => shape.shape),
    ).toContain("9")
    expect(after.get(media)).toEqual(parts.get(media))
  })

  it("declares on the pasted layer a prefix its old slide declared and its new slide does not", async () => {
    const parts = new Map(await fixture("picture-png.pptx"))
    const declared = 'xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main"'
    const marked = decodeUtf8(parts.get(firstPart)!)
      .replace("<p:sld ", `<p:sld ${declared} `)
      .replace(
        '<p:cNvPr id="4" name="Picture 4"/>',
        '<p:cNvPr id="4" name="Picture 4"><a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}"><a16:creationId id="{00000000-0000-0000-0000-000000000004}"/></a:ext></a:extLst></p:cNvPr>',
      )
    parts.set(firstPart, encodeUtf8(marked))
    const { after } = pastedOnto(parts)
    const xml = decodeUtf8(after.get(partOfSlide(after, "257"))!)
    expect(xml).toContain(`<p:pic ${declared}><p:nvPicPr><p:cNvPr id="9"`)
  })

  it("writes a layer pasted from a slide deleted after the copy", async () => {
    const parts = await fixture("picture-png.pptx")
    const { register } = pastedOnto(parts)
    const deleted = landed(register, [{ slide: "remove", id: first }])
    const after = exported(parts, deleted)
    expect(readShapes(after).map((shape) => [shape.slide, shape.shape])).toContainEqual(["257", "9"])
    expect(readShapes(after).some((shape) => shape.slide === "256")).toBe(false)
  })
})

describe("a layer holding a picture added on this device pastes onto another slide", () => {
  const photo = elementId("256.5")
  const oval = elementId("256.6")
  const group = elementId("256.7")
  const media: Media = { sha256: "c3".repeat(32), type: "image/png" }
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const named = `ppt/media/picture-${"c3".repeat(8)}.png`
  const box = { x: 0, y: 0, cx: 3048000, cy: 2032000 }

  function decided(register: Register, command: Command): Register {
    const decision = decide(register, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }

  function ran(register: Register, commands: readonly Command[]): Register {
    return commands.reduce((current, command) => {
      const node = command.command === "person" ? command.node : undefined
      const known = node === undefined || current.nodes.includes(node)
      const named = known ? current : decided(current, { command: "add", node, floor: "", route: "" })
      return decided(named, command)
    }, register)
  }

  function onAnotherSlide(register: Register, source: ElementId): Register {
    const blank = landed(register, [newSlide])
    const made = cloneOf(blank, source, pasted, at)
    if (!made.ok) throw new Error(made.refusal)
    return landed(blank, [made.command])
  }

  async function photographed(): Promise<{ parts: Parts; register: Register }> {
    const parts = await fixture("picture-png.pptx")
    const element = { node: photo, kind: "shape", value: null, box, grouped: false } as const
    const shape = { node: oval, kind: "shape", value: null, box, grouped: false } as const
    const register = landed(opened(parts), [
      { slide: "element-add", id: first, element, media },
      { slide: "element-add", id: first, element: shape, geometry: "ellipse" },
    ])
    return { parts, register }
  }

  function linked(parts: Parts, slide: string): boolean {
    const part = partOfSlide(parts, slide)
    return decodeUtf8(parts.get(part.replace("slides/", "slides/_rels/") + ".rels")!).includes(
      `Target="../${named.slice("ppt/".length)}"`,
    )
  }

  it("links a pasted picture whose bytes this device has not read yet, and writes the image once they arrive", async () => {
    const { parts, register } = await photographed()
    const pasting = onAnotherSlide(register, photo)
    const waiting = orderedParts(parts, pasting)
    expect([linked(waiting, "256"), linked(waiting, "257"), waiting.has(named)]).toEqual([true, true, false])
    const read = orderedParts(parts, pasting, (sha256) => (sha256 === media.sha256 ? png : undefined))
    expect([linked(read, "256"), linked(read, "257")]).toEqual([true, true])
    expect(read.get(named)).toEqual(png)
  })

  it("links a pasted icon to the same icon parts, whose bytes the device adds on export", async () => {
    const parts = await fixture("picture-png.pptx")
    const opening = { fills: { source: { set: "rocket" } } }
    const element = { node: photo, kind: "shape", value: null, box, grouped: false, opening } as const
    const pasting = onAnotherSlide(landed(opened(parts), [{ slide: "element-add", id: first, element }]), photo)
    const waiting = orderedParts(parts, pasting)
    const rels = decodeUtf8(waiting.get(partOfSlide(waiting, "257").replace("slides/", "slides/_rels/") + ".rels")!)
    expect(rels).toContain('Target="../media/icon-rocket.png"')
    expect(rels).toContain('Target="../media/icon-rocket.svg"')
  })

  it("pastes a mask group around that picture with both its layers and the image link", async () => {
    const { parts, register } = await photographed()
    const turn = maskTurn(register, [first], first, group, [photo, oval], oval)
    if (turn === null) throw new Error("mask")
    const pasting = onAnotherSlide(ran(register, turn.commands), group)
    const waiting = orderedParts(parts, pasting)
    expect(
      readShapes(waiting)
        .filter((shape) => shape.slide === "257")
        .map((shape) => shape.shape),
    ).toEqual(expect.arrayContaining(["9", "10", "11"]))
    expect(linked(waiting, "257")).toBe(true)
    const read = exportParts(
      orderedParts(parts, pasting, () => png),
      pasting,
    )
    expect(linked(read, "257")).toBe(true)
    expect(read.get(named)).toEqual(png)
  })
})
