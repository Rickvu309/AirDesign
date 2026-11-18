declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import {
  decide,
  elementId,
  format,
  openRegister,
  orderKeyBetween,
  slideId,
  type Command,
  type ElementPatch,
  type IndexElement,
  type Register,
  type SlideCommand,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts, orderedParts, paintReader, shownBackground, readParts, readSlides } from "./index.js"
import { decodeUtf8 } from "./package-bytes.js"

type Parts = ReadonlyMap<string, Uint8Array>

const { readFileSync } = process.getBuiltinModule("node:fs")
const fixture = (name: string) => readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))
const text = (bytes: Uint8Array | undefined) => (bytes === undefined ? "" : decodeUtf8(bytes))
const accent: ElementPatch = { fills: { p0: { set: { solid: { scheme: "accent1" } } } } }
const navy: ElementPatch = { fills: { p0: { set: { solid: { rgb: "0F2433" } } } } }
const written = (val: string) => `<p:bg><p:bgPr><a:solidFill>${val}</a:solidFill><a:effectLst/></p:bgPr></p:bg>`

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function filled(parts: Parts, rows: readonly (readonly [string, ElementPatch])[], order: SlideCommand[] = []) {
  const file = readSlides(parts).map((each) => slideId(each.slide))
  let register: Register = { ...openRegister("", "deck"), file, order }
  for (const [node, patch] of rows) {
    const id = elementId(node)
    if (!register.nodes.includes(id))
      register = landed(register, { command: "add", node: id, floor: "", route: "deck" })
    register = landed(register, { command: "person", node: id, v: format, patch })
  }
  return exportParts(orderedParts(parts, register), register)
}

function changedParts(before: Parts, after: Parts): string[] {
  const names = new Set([...before.keys(), ...after.keys()])
  return [...names].filter((name) => before.get(name) !== after.get(name)).sort()
}

function shown(parts: Parts, part: string) {
  return paintReader(parts).slide(part).background
}

async function firstOf(name: string) {
  const parts = await fixture(name)
  const [first] = readSlides(parts)
  if (first === undefined) throw new Error("slide")
  return { parts, first, node: `${first.slide}.slide` }
}

describe("a slide's fill is its background", () => {
  it("writes a theme colour as the first child of the slide's cSld, and changes no other part", async () => {
    const { parts, first, node } = await firstOf("blank.pptx")
    const next = filled(parts, [[node, accent]])
    expect(changedParts(parts, next)).toEqual([first.part])
    expect(text(next.get(first.part))).toContain(`<p:cSld>${written('<a:schemeClr val="accent1"/>')}<p:spTree>`)
    expect(shown(next, first.part)).toEqual({ type: "solid", color: { hex: "2D6FCD", alpha: 1 } })
    expect(filled(next, [[node, accent]])).toEqual(next)
  })

  it("replaces the slide's own background and keeps the rest of the slide's bytes", async () => {
    const { parts, first, node } = await firstOf("nasa-1d-cnn.pptx")
    const before = text(parts.get(first.part))
    const own = /<p:bg>.*?<\/p:bg>/.exec(before)?.[0]
    if (own === undefined) throw new Error("background")
    const next = filled(parts, [[node, navy]])
    expect(text(next.get(first.part))).toBe(before.replace(own, written('<a:srgbClr val="0F2433"/>')))
    expect(shown(next, first.part)).toEqual({ type: "solid", color: { hex: "0F2433", alpha: 1 } })
  })

  it("keeps the file's bytes when the slide goes back to the background it opened with", async () => {
    const { parts, node } = await firstOf("nasa-1d-cnn.pptx")
    const next = filled(parts, [
      [node, navy],
      [node, { fills: { p0: "opening" } }],
    ])
    expect(changedParts(parts, next)).toEqual([])
  })

  it("removes the slide's own background so its layout's shows again", async () => {
    const { parts, first, node } = await firstOf("nasa-1d-cnn.pptx")
    const next = filled(parts, [[node, { fills: { p0: "inherit" } }]])
    const before = text(parts.get(first.part))
    const own = /<p:bg>.*?<\/p:bg>/.exec(before)?.[0] ?? ""
    expect(text(next.get(first.part))).toBe(before.replace(own, ""))
    expect(changedParts(parts, next)).toEqual([first.part])
  })

  it("writes a gradient background and paints it", async () => {
    const { parts, first, node } = await firstOf("blank.pptx")
    const gradient: ElementPatch = {
      fills: {
        p0: {
          set: {
            gradient: {
              stops: [
                { pos: 0, color: { scheme: "accent1" } },
                { pos: 100_000, color: { rgb: "0F2433" } },
              ],
              shade: { linear: { angle: 5_400_000, scaled: false } },
              rotateWithShape: false,
            },
          },
        },
      },
    }
    const next = filled(parts, [[node, gradient]])
    expect(text(next.get(first.part))).toContain(
      '<p:cSld><p:bg><p:bgPr><a:gradFill rotWithShape="0"><a:gsLst><a:gs pos="0"><a:schemeClr val="accent1"/></a:gs><a:gs pos="100000"><a:srgbClr val="0F2433"/></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:effectLst/></p:bgPr></p:bg><p:spTree>',
    )
    expect(shown(next, first.part)?.type).toBe("gradient")
    expect(shownBackground(next, first.part)).toEqual({
      value: typeof gradient.fills?.p0 === "object" && "set" in gradient.fills.p0 ? gradient.fills.p0.set : null,
      own: true,
    })
  })

  it("writes a native picture background and reads its existing fill control value", async () => {
    const { parts, first, node } = await firstOf("blank.pptx")
    const next = filled(parts, [[node, { fills: { p0: { set: { image: true } }, source: { set: "star" } } }]])
    expect(text(next.get(first.part))).toContain("<p:bg><p:bgPr><a:blipFill")
    expect(shown(next, first.part)?.type).toBe("picture")
    expect(shownBackground(next, first.part)).toEqual({ value: { image: true }, own: true })
    expect(changedParts(next, filled(next, []))).toEqual([])
  })

  it("reads an inherited fill without adding a slide override", async () => {
    const { parts, first } = await firstOf("blank.pptx")
    const before = text(parts.get(first.part))
    expect(shownBackground(parts, first.part)?.own).toBe(false)
    expect(text(filled(parts, []).get(first.part))).toBe(before)
  })

  it("gives a duplicate the background its floor carries, and a later colour stays on its own slide", async () => {
    const { parts, first, node } = await firstOf("blank.pptx")
    const copy = slideId("900")
    const own: IndexElement = {
      node: elementId("900.slide"),
      kind: "slide",
      value: null,
      box: null,
      grouped: false,
      opening: navy,
    }
    const clone: SlideCommand = {
      slide: "clone",
      id: copy,
      source: slideId(first.slide),
      key: orderKeyBetween(null, null),
      floor: [own],
    }
    const next = filled(parts, [[node, accent]], [clone])
    const cloned = readSlides(next).find((each) => each.slide === "900")
    if (cloned === undefined) throw new Error("clone")
    expect(shown(next, first.part)).toEqual({ type: "solid", color: { hex: "2D6FCD", alpha: 1 } })
    expect(shown(next, cloned.part)).toEqual({ type: "solid", color: { hex: "0F2433", alpha: 1 } })
    const back = filled(
      parts,
      [
        [node, accent],
        ["900.slide", { fills: { p0: "opening" } }],
      ],
      [clone],
    )
    expect(shown(back, cloned.part)).toEqual({ type: "solid", color: { hex: "0F2433", alpha: 1 } })
  })
})
