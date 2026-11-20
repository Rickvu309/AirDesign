import { describe, expect, it } from "vitest"
import {
  addedPictures,
  decide,
  elementGone,
  elementId,
  elementsUndoable,
  nextElementId,
  openingElement,
  openRegister,
  readSlideState,
  slideId,
  undoOf,
  type IndexElement,
  type PastedLayers,
  type Register,
  type SlideCommand,
} from "./index.js"

const file = [slideId("256")]
const box = { x: 100, y: 200, cx: 300, cy: 400 }
const top = elementId("256.9")
const inner = elementId("256.10")
const media = { sha256: "a".repeat(64), type: "image/png" } as const

const register: Register = {
  ...openRegister("", ""),
  index: {
    total: 1,
    slides: [{ id: "256", position: 0 }],
    elements: [{ node: elementId("256.2"), kind: "shape", value: "Title", box, grouped: false }],
    pages: [{ once: "page", offset: 0, count: 1 }],
  },
}

const picture =
  '<p:pic><p:nvPicPr><p:cNvPr id="4" name="Picture 4"/></p:nvPicPr><p:blipFill><a:blip r:embed="pasted0"/></p:blipFill></p:pic>'
const grouped =
  '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="5" name="Group 5"/></p:nvGrpSpPr><p:sp><p:nvSpPr><p:cNvPr id="6" name="Inside"/></p:nvSpPr></p:sp></p:grpSp>'

function added(element: IndexElement, pasted: PastedLayers): Extract<SlideCommand, { slide: "element-add" }> {
  return { slide: "element-add", id: file[0]!, element, pasted }
}

function decision(edit: SlideCommand) {
  return decide(register, { command: "slide", file, edit })
}

const shape: IndexElement = { node: top, kind: "shape", value: null, box, grouped: false }
const group: IndexElement = { node: top, kind: "group", value: null, box, grouped: false }
const layer: IndexElement = { node: inner, kind: "shape", value: "Inside", box, grouped: true, group: top }

describe("pasted layers", () => {
  it("adds a layer pasted from another deck with its markup and its image", () => {
    const edit = added(shape, { markup: picture, shape: "4", media: [media], layers: [] })
    const made = decision(edit)
    if (made.decision !== "apply") throw new Error(made.code)
    expect(openingElement(made.register, top)).toMatchObject({ node: top, box })
    expect(addedPictures(made.register)).toEqual([media])
  })

  it("adds a pasted group with a node for each layer in it, and one undo takes them all", () => {
    const edit = added(group, { markup: grouped, shape: "5", media: [], layers: [{ shape: "6", element: layer }] })
    const made = decision(edit)
    if (made.decision !== "apply") throw new Error(made.code)
    expect(openingElement(made.register, inner)?.value).toBe("Inside")
    expect(nextElementId(made.register, file[0]!, 3)).toBe("256.11")
    const undoable = elementsUndoable(register, file, [edit])
    if (undoable === null) throw new Error("no undo")
    const undone = undoOf(made.register, undoable)
    if (!undone.ok) throw new Error("no undo")
    let after = made.register
    for (const each of undone.commands) {
      const next = decide(after, each)
      if (next.decision !== "apply") throw new Error(next.code)
      after = next.register
    }
    expect(elementGone(after, top)).toBe(true)
    expect(elementGone(after, inner)).toBe(true)
  })

  it("refuses markup that is not one layer, a placeholder, a kind that does not match, a used id and loose layers", () => {
    const pasted = { markup: picture, shape: "4", media: [media], layers: [] }
    expect(decision(added(shape, { ...pasted, markup: "<p:sld></p:sld>" })).decision).toBe("refuse")
    expect(
      decision(added(shape, { ...pasted, markup: picture.replace("<p:nvPr/>", "") + "<p:sp></p:sp>" })).decision,
    ).toBe("refuse")
    const titled = picture.replace("</p:nvPicPr>", '<p:nvPr><p:ph type="title"/></p:nvPr></p:nvPicPr>')
    expect(decision(added(shape, { ...pasted, markup: titled })).decision).toBe("refuse")
    expect(decision(added({ ...shape, kind: "connector" }, pasted)).decision).toBe("refuse")
    expect(decision(added({ ...shape, node: elementId("256.2") }, pasted)).decision).toBe("refuse")
    const loose = {
      markup: grouped,
      shape: "5",
      media: [],
      layers: [{ shape: "6", element: { ...layer, group: elementId("256.2") } }],
    }
    expect(decision(added(group, loose)).decision).toBe("refuse")
    const taken = {
      markup: grouped,
      shape: "5",
      media: [],
      layers: [{ shape: "6", element: { ...layer, node: elementId("256.2") } }],
    }
    expect(decision(added(group, taken)).decision).toBe("refuse")
  })

  it("stores a pasted layer and reads it back, and refuses a broken one", () => {
    const edit = added(group, { markup: grouped, shape: "5", media: [media], layers: [{ shape: "6", element: layer }] })
    const stored = JSON.parse(JSON.stringify({ file, order: [edit] })) as unknown
    expect(readSlideState(stored)?.order).toEqual([edit])
    const broken = { ...edit, pasted: { markup: grouped, shape: "five", media: [], layers: [] } }
    expect(readSlideState({ file, order: [broken] })).toBeUndefined()
    expect(readSlideState({ file, order: [{ ...edit, media }] })).toBeUndefined()
  })
})
