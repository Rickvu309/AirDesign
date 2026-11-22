import {
  decide,
  elementId,
  format,
  openRegister,
  orderKeyAfter,
  presentSlides,
  slideId,
  writeTextValue,
  type Box,
  type Command,
  type ElementPatch,
  type Register,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { notesLinkFailures, paintReader, readNotes, readParts, readShapes, readSlides } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { exportedParts, storedText } from "./editing/exported-parts"
import { shownValue } from "./editing/live-repaint"
import { flooredEdit } from "./editing/slide-floor"

type Parts = ReadonlyMap<string, Uint8Array>

async function fixture(name: string): Promise<Parts> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL(`../../../scripts/pptx-fixtures/${name}`, import.meta.url)))
}

function applied(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision === "refuse") throw new Error(decision.code)
  return decision.register
}

function opened(register: Register, node: string): Register {
  const id = elementId(node)
  if (register.nodes.includes(id)) return register
  return applied(register, { command: "add", node: id, floor: "", route: register.route })
}

function typed(register: Register, node: string, text: string, run = 0): Register {
  const value = writeTextValue([{ from: 0, runs: [{ from: run, text }] }])
  return applied(opened(register, node), { command: "person", value, node: elementId(node) })
}

function moved(register: Register, node: string, box: Box): Register {
  return applied(opened(register, node), { command: "person", property: "box", value: box, node: elementId(node) })
}

function sliding(parts: Parts, register: Register, edit: SlideCommand): Register {
  const file = register.file.length > 0 ? register.file : readSlides(parts).map((slide) => slideId(slide.slide))
  return applied(register, { command: "slide", file, edit: flooredEdit(parts, register, file, edit) })
}

function after(parts: Parts, register: Register, slide: SlideId) {
  const file = register.file.length > 0 ? register.file : readSlides(parts).map((each) => slideId(each.slide))
  const key = orderKeyAfter(presentSlides({ file, order: register.order }), slide)
  if (key === null) throw new Error("key")
  return key
}

function shown(parts: Parts) {
  return Object.fromEntries(
    readShapes(parts).map((shape) => [
      `${shape.slide}.${shape.shape}`,
      {
        text: shape.text.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n"),
        box: shape.box,
      },
    ]),
  )
}

const source = slideId("256")
const copy = slideId("257")
const sourceBox = { x: 457200, y: 457200, cx: 5486400, cy: 1828800 }

it("keeps a duplicate as its slide was when it was made, after the original is edited", async () => {
  const parts = await fixture("clean.pptx")
  let register = typed(openRegister("", "deck"), "256.2", "Before the copy")
  register = sliding(parts, register, { slide: "clone", id: copy, source, key: after(parts, register, source) })
  register = typed(register, "256.2", "Original moved on")
  register = moved(register, "256.2", { ...sourceBox, x: 0 })
  const file = storedText(readShapes(parts)[0]?.text ?? [])
  expect(shownValue(register, elementId("257.2"), file)).toBe(
    writeTextValue([{ from: 0, runs: [{ from: 0, text: "Before the copy" }] }]),
  )
  expect(shown(exportedParts(parts, register))).toEqual({
    "256.2": { text: "Original moved on", box: { ...sourceBox, x: 0 } },
    "257.2": { text: "Before the copy", box: sourceBox },
  })
})

it("keeps the original as it was when the duplicate is edited and moved", async () => {
  const parts = await fixture("clean.pptx")
  let register = sliding(parts, openRegister("", "deck"), {
    slide: "clone",
    id: copy,
    source,
    key: after(parts, openRegister("", "deck"), source),
  })
  register = typed(register, "257.2", "Copy title")
  register = moved(register, "257.2", { ...sourceBox, y: 9 })
  const exported = exportedParts(parts, register)
  expect(shown(exported)).toEqual({
    "256.2": { text: "Hello", box: sourceBox },
    "257.2": { text: "Copy title", box: { ...sourceBox, y: 9 } },
  })
  expect(exported.get("ppt/slides/slide1.xml")).toBe(parts.get("ppt/slides/slide1.xml"))
})

it("copies a duplicate of a duplicate from the first copy as it was then", async () => {
  const parts = await fixture("clean.pptx")
  let register = sliding(parts, openRegister("", "deck"), {
    slide: "clone",
    id: copy,
    source,
    key: after(parts, openRegister("", "deck"), source),
  })
  register = typed(register, "257.2", "First copy")
  const second = slideId("258")
  register = sliding(parts, register, { slide: "clone", id: second, source: copy, key: after(parts, register, copy) })
  register = typed(register, "257.2", "First copy moved on")
  expect(shown(exportedParts(parts, register))).toMatchObject({
    "256.2": { text: "Hello" },
    "257.2": { text: "First copy moved on" },
    "258.2": { text: "First copy" },
  })
})

it("leaves a box the person removed out of their duplicate and out of the exported copy", async () => {
  const parts = await fixture("clean.pptx")
  let register = sliding(parts, openRegister("", "deck"), {
    slide: "element-remove",
    id: source,
    node: elementId("256.2"),
  })
  register = sliding(parts, register, { slide: "clone", id: copy, source, key: after(parts, register, source) })
  const clone = register.order.at(-1)
  expect(clone?.slide === "clone" ? clone.floor : undefined).toEqual([
    { node: elementId("257.slide"), kind: "slide", value: null, box: null, grouped: false },
  ])
  expect(shown(exportedParts(parts, register))).toEqual({})
})

it("takes typed text in a placeholder of a new slide", async () => {
  const parts = await fixture("blank.pptx")
  const first = slideId(readSlides(parts)[0]?.slide ?? "")
  const id = slideId("300")
  const empty = openRegister("", "deck")
  const register = sliding(parts, empty, {
    slide: "add",
    id,
    after: first,
    key: after(parts, empty, first),
    layout: first,
  })
  const floor = register.order[0]?.slide === "add" ? (register.order[0].floor ?? []) : []
  const title = floor[0]?.node
  expect(title?.startsWith("300.")).toBe(true)
  if (title === undefined) throw new Error("floor")
  const exported = exportedParts(parts, typed(register, title, "Typed on a new slide", -1))
  expect(shown(exported)[title]?.text).toBe("Typed on a new slide")
  for (const [name, bytes] of parts) {
    if (name.startsWith("ppt/slides/") || name.startsWith("ppt/presentation") || name.startsWith("ppt/_rels")) continue
    if (name === "[Content_Types].xml") continue
    expect(exported.get(name), name).toBe(bytes)
  }
})

it("writes first notes on a blank deck's slide, a new slide and a copy that keeps its source's notes", async () => {
  const parts = await fixture("blank.pptx")
  const first = slideId("256")
  const noted = (register: Register, node: string, value: string) =>
    applied(opened(register, node), { command: "person", value, node: elementId(node) })
  let register = noted(openRegister("", "deck"), "256.notes", "Opening line")
  const added = slideId("300")
  register = sliding(parts, register, {
    slide: "add",
    id: added,
    after: first,
    key: after(parts, register, first),
    layout: first,
  })
  register = noted(register, "300.notes", "Second slide")
  register = sliding(parts, register, {
    slide: "clone",
    id: slideId("301"),
    source: first,
    key: after(parts, register, first),
  })
  register = noted(register, "256.notes", "Opening line, later")
  const exported = exportedParts(parts, register)
  expect(Object.fromEntries(readNotes(exported).map((notes) => [notes.slide, notes.text]))).toEqual({
    "256": "Opening line, later",
    "300": "Second slide",
    "301": "Opening line",
  })
  expect(notesLinkFailures(exported)).toEqual([])
})

it("gives a duplicate the background the person set on its source, and keeps the copy's own colour after", async () => {
  const parts = await fixture("clean.pptx")
  const navy = { set: { solid: { rgb: "0F2433" } } } as const
  const filled = (register: Register, node: string, patch: ElementPatch): Register =>
    applied(opened(register, node), { command: "person", v: format, patch, node: elementId(node) })
  let register = filled(openRegister("", "deck"), "256.slide", { fills: { p0: navy } })
  register = sliding(parts, register, { slide: "clone", id: copy, source, key: after(parts, register, source) })
  register = filled(register, "256.slide", { fills: { p0: "opening" } })
  const clone = register.order.at(-1)
  expect(clone?.slide === "clone" ? clone.floor?.find((row) => row.node === "257.slide") : undefined).toEqual({
    node: elementId("257.slide"),
    kind: "slide",
    value: null,
    box: null,
    grouped: false,
    opening: { fills: { p0: navy } },
  })
  const exported = exportedParts(parts, register)
  const painted = new Map(
    readSlides(exported).map((slide) => [slide.slide, paintReader(exported).slide(slide.part).background]),
  )
  expect(painted.get("257")).toEqual({ type: "solid", color: { hex: "0F2433", alpha: 1 } })
  expect(painted.get("256")).not.toEqual(painted.get("257"))
})
