import {
  decide,
  elementId,
  format,
  openRegister,
  readChartValue,
  templateStylesNode,
  writeTextValue,
  type Box,
  type Command,
  type Register,
} from "@airdesign/document"
import { fileChartValue, iconParts, indexPackage, readPackage, readParts, readShapes } from "@airdesign/pptx"
import { paintStore, type PaintStore } from "@airdesign/render"
import { beforeAll, expect, it } from "vitest"
import { paint } from "./deck-paint"
import { elementCommand, removals } from "./element-edit"
import { busyElements } from "./live-repaint"
import { pictureCommand } from "./picture-add"
import { fileSlides } from "./slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

let parts: Parts = new Map()

beforeAll(async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/doe-heat-pumps.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  parts = read.parts
}, 30_000)

const room = { width: 9_144_000, height: 6_858_000 }

function changed(register: Register, change: Parameters<typeof elementCommand>[2]): Register {
  const edit = elementCommand(parts, register, change)
  if (edit === null) throw new Error("refused")
  return { ...register, file: fileSlides(parts, register), order: [...register.order, edit] }
}

function person(register: Register, node: string, value: string | Box): Register {
  const id = elementId(node)
  let next = register
  if (!next.nodes.includes(id)) {
    const added = decide(next, { command: "add", node: id, floor: "", route: next.route })
    if (added.decision === "refuse") throw new Error(added.code)
    next = added.register
  }
  const edited = decide(
    next,
    typeof value === "string"
      ? { command: "person", node: id, value }
      : { command: "person", node: id, property: "box", value },
  )
  if (edited.decision === "refuse") throw new Error(edited.code)
  return edited.register
}

function shown(painted: ReturnType<typeof paint>, store: PaintStore): string {
  const sorted = <T>(map: ReadonlyMap<string, T>) => [...map].sort(([left], [right]) => left.localeCompare(right))
  return JSON.stringify({
    count: painted.count,
    canvases: Array.from({ length: painted.count }, (_, index) => painted.canvases(index)),
    boxes: sorted(painted.boxes),
    movables: sorted(painted.movables),
    shapes: sorted(painted.shapes),
    files: sorted(painted.files),
    store: store.slides().map((slide) => slide.elements.map((id) => [store.getElement(id), store.getBox(id)])),
  }).replaceAll(/blob:[^"\\)]+/g, "blob")
}

function elementOn(store: PaintStore, slide: number, offered: ReadonlyMap<string, unknown>): string {
  const found = store.slides()[slide]?.elements.find((id) => offered.has(id))
  if (found === undefined) throw new Error("element")
  return found
}

function removed(register: Register, store: PaintStore, slide: number): Register {
  for (const node of store.slides()[slide]?.elements ?? []) {
    const [edit] = removals(parts, register, [elementId(node)]).edits
    if (edit !== undefined) return { ...register, file: fileSlides(parts, register), order: [...register.order, edit] }
  }
  throw new Error("nothing to remove")
}

it("each one-element edit on a 5 MB deck repaints its own slide and paints what a whole paint paints", ({ task }) => {
  const store = paintStore()
  const busy = busyElements()
  let register = openRegister("", "clean")
  let painted = paint(store, parts, register, busy)
  expect(painted.repainted).toHaveLength(painted.count)
  const typed = writeTextValue([{ from: 0, runs: [{ from: -1, text: "Typed" }] }])
  const edits: readonly (readonly [number, (before: Register) => Register])[] = [
    [2, (before) => changed(before, { change: "text", index: 2, size: room })],
    [4, (before) => changed(before, { change: "shape", geometry: "rect", index: 4, size: room })],
    [6, (before) => removed(before, store, 6)],
    [2, (before) => person(before, elementOn(store, 2, painted.boxes), typed)],
    [
      3,
      (before) => person(before, elementOn(store, 3, painted.movables), { x: 100, y: 200, cx: 300_000, cy: 400_000 }),
    ],
  ]
  const counts: number[] = []
  for (const [slide, edit] of edits) {
    const id = store.slides()[slide]?.id
    register = edit(register)
    painted = paint(store, parts, register, busy, new Map(), painted)
    expect(painted.repainted).toEqual([id])
    counts.push(painted.repainted.length)
    const whole = paintStore()
    expect(shown(painted, store)).toEqual(shown(paint(whole, parts, register, busy), whole))
  }
  Object.assign(task.meta, { measured: { "slides-repainted": Math.max(...counts) } })
}, 120_000)

it("a slide added to the deck repaints every slide", () => {
  const store = paintStore()
  const busy = busyElements()
  const register = openRegister("", "clean")
  const first = paint(store, parts, register, busy)
  const added = changed(register, { change: "text", index: 0, size: room })
  const file = fileSlides(parts, added)
  const slide = { slide: "add", id: "9001", after: file[0] ?? "", key: "a0V", layout: file[0] ?? "" } as const
  const next = paint(store, parts, { ...added, order: [...added.order, slide] } as Register, busy, new Map(), first)
  expect(next.repainted).toHaveLength(next.count)
  expect(next.count).toBe(first.count + 1)
}, 120_000)

it("a paint with nothing changed repaints no slide and hands back the same canvases, and a whole paint makes new ones", () => {
  const store = paintStore()
  const busy = busyElements()
  const register = changed(openRegister("", "clean"), { change: "text", index: 1, size: room })
  const first = paint(store, parts, register, busy)
  const canvases = Array.from({ length: first.count }, (_, index) => first.canvases(index))
  const again = paint(store, parts, register, busy, new Map(), first)
  expect(again.repainted).toEqual([])
  canvases.forEach((canvas, index) => expect(again.canvases(index)).toBe(canvas))
  const whole = paint(store, parts, register, busy)
  expect(whole.repainted).toHaveLength(whole.count)
  expect(whole.canvases(1)).not.toBe(canvases[1])
}, 120_000)

it("paints a picture once its bytes arrive after the slide was painted without them", () => {
  const store = paintStore()
  const busy = busyElements()
  const sha256 = "a".repeat(64)
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
  const register = openRegister("", "clean")
  const edit = pictureCommand(
    parts,
    register,
    1,
    { media: { sha256, type: "image/png" } },
    { x: 0, y: 0, cx: 9525, cy: 9525 },
  )
  if (edit === null) throw new Error("refused")
  const added = { ...register, file: fileSlides(parts, register), order: [edit] }
  const waiting = paint(store, parts, added, busy)
  waiting.canvases(1)
  const pictures = new Map([[sha256, png]])
  const loaded = paint(store, parts, added, busy, pictures, waiting)
  const whole = paintStore()
  expect(shown(loaded, store)).toEqual(shown(paint(whole, parts, added, busy, pictures), whole))
}, 120_000)

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

it("paints a slide's typed title in the template style's new heading font, as it paints an untouched slide", () => {
  const typed = person(openRegister("", "doe"), "256.2", "Heat pumps")
  const opened = decide(typed, { command: "add", node: templateStylesNode, floor: "", route: "doe" })
  if (opened.decision === "refuse") throw new Error(opened.code)
  const patch = { templateStyle: { major: { set: "Georgia" } } }
  const edited = decide(opened.register, { command: "person", node: templateStylesNode, v: format, patch })
  if (edited.decision === "refuse") throw new Error(edited.code)
  const painted = paint(paintStore(), parts, edited.register, busyElements())
  const title = (index: number) =>
    JSON.stringify(painted.canvases(index)?.elements.find((element) => element.key.endsWith("#2"))?.text)
  expect(title(0)).toContain('"font":"Georgia"')
  expect(title(0)).not.toContain('"font":"Calibri Light"')
  expect(title(1)).toContain('"font":"Georgia"')
})

it("holds the fit the file stored on a box until its text, its size or its text layout changes", () => {
  const subtitle = elementId("256.3")
  const fitOf = (register: Register) =>
    paint(paintStore(), parts, register, busyElements())
      .canvases(0)
      ?.elements.find((element) => element.id === subtitle)?.text?.fit
  const opened = openRegister("", "doe")
  const box = { x: 1_143_000, y: 3_429_000, cx: 6_858_000, cy: 1_042_516 }
  expect(fitOf(opened)).toEqual({ kind: "shrink", scale: 0.775, reduction: 0.2, held: true })
  expect(fitOf(person(opened, subtitle, { ...box, x: 0 }))).toEqual({
    kind: "shrink",
    scale: 0.775,
    reduction: 0.2,
    held: true,
  })
  expect(fitOf(person(opened, subtitle, { ...box, cy: 900_000 }))).toEqual({
    kind: "shrink",
    scale: 0.775,
    reduction: 0.2,
  })
  const typed = writeTextValue([{ from: 0, runs: [{ from: -1, text: "Typed" }] }])
  expect(fitOf(person(opened, subtitle, typed))).toEqual({ kind: "shrink", scale: 0.775, reduction: 0.2 })
  const designed = (patch: Extract<Command, { readonly v: number }>["patch"]) => {
    const added = decide(opened, { command: "add", node: subtitle, floor: "", route: "doe" })
    if (added.decision === "refuse") throw new Error(added.code)
    const edited = decide(added.register, { command: "person", node: subtitle, v: format, patch })
    if (edited.decision === "refuse") throw new Error(edited.code)
    return edited.register
  }
  expect(fitOf(designed({ fills: { p0: { set: { solid: { scheme: "accent2" } } } } }))).toEqual({
    kind: "shrink",
    scale: 0.775,
    reduction: 0.2,
    held: true,
  })
  expect(fitOf(designed({ body: { columns: { set: 2 } } }))).toEqual({ kind: "shrink", scale: 0.775, reduction: 0.2 })
}, 120_000)

it("paints a title filled with an icon as the exported picture clipped to its letters", () => {
  const value = writeTextValue([{ from: 0, runs: [{ from: 0, text: "Heat pumps", fill: { image: "star" } }] }])
  const icon = iconParts("star")
  const bytes = new Map([
    [icon.svg, new TextEncoder().encode("<svg/>")],
    [icon.png, new Uint8Array([1])],
  ])
  const run = (register: Register) =>
    paint(paintStore(), parts, register, busyElements(), bytes)
      .canvases(0)
      ?.elements.find((element) => element.key.endsWith("#2"))?.text?.paragraphs[0]?.runs[0]
  expect(run(person(openRegister("", "doe"), "256.2", value))?.picture).toMatch(/^url\(/)
  expect(run(person(openRegister("", "doe"), "256.2", "Heat pumps"))?.picture).toBeUndefined()
})

it("paints a Fill picture covering the frame a person made portrait", async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const file = await readParts(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/picture-png.pptx", import.meta.url)),
  )
  const index = indexPackage(file)
  const picture = elementId("256.4")
  const opened = {
    ...openRegister("", "clean"),
    index: { ...index, total: index.elements.length, pages: [] },
  }
  const added = landed(opened, { command: "add", node: picture, floor: "", route: "clean" })
  const resized = landed(added, {
    command: "person",
    node: picture,
    property: "box",
    value: { x: 3_810_000, y: 1_905_000, cx: 4_572_000, cy: 6_858_000 },
  })
  const painted = paint(paintStore(), file, resized, busyElements())
    .canvases(0)
    ?.elements.find((element) => element.id === picture)
  expect(painted?.fill).toContain("50% 0% / 225% 100%")
})

it("paints that cover when the device register kept the box and lost the opening size", async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const file = await readParts(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/picture-png.pptx", import.meta.url)),
  )
  const picture = elementId("256.4")
  const added = landed(openRegister("", "clean"), { command: "add", node: picture, floor: "", route: "clean" })
  expect(added.elements[picture]?.floorBox).toBeUndefined()
  const resized = landed(added, {
    command: "person",
    node: picture,
    property: "box",
    value: { x: 3_810_000, y: 1_905_000, cx: 4_572_000, cy: 6_858_000 },
  })
  const painted = paint(paintStore(), file, resized, busyElements())
    .canvases(0)
    ?.elements.find((element) => element.id === picture)
  expect(painted?.fill).toContain("50% 0% / 225% 100%")
})

it("offers a chart made in AirDesign to move and select", () => {
  const store = paintStore()
  const busy = busyElements()
  const register = changed(openRegister("", "clean"), { change: "chart", kind: "bar", index: 1, size: room })
  const painted = paint(store, parts, register, busy)
  const [add] = register.order
  const node = add !== undefined && "element" in add ? add.element.node : null
  expect(node).not.toBeNull()
  expect(painted.movables.has(elementId(node ?? ""))).toBe(true)
  const value = add !== undefined && "element" in add ? (add.element.value ?? "") : ""
  const chart = { value: { set: value.replace("Series 1", "Revenue") } }
  const added = decide(register, { command: "add", node: elementId(node ?? ""), floor: "", route: register.route })
  if (added.decision === "refuse") throw new Error(added.code)
  const edited = decide(added.register, { command: "person", node: elementId(node ?? ""), v: format, patch: { chart } })
  if (edited.decision === "refuse") throw new Error(edited.code)
  paint(store, parts, edited.register, busy, new Map(), painted)
  expect(store.getElement(elementId(node ?? ""))?.text).toBe("")
}, 120_000)

it("offers an imported PowerPoint chart to move and select, and holds its numbers from the file", async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/census-updating-spm.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  const charts = readShapes(read.parts).filter((shape) => shape.contentKind === "chart")
  expect(charts.length).toBe(4)
  const painted = paint(paintStore(), read.parts, openRegister("", "clean"), busyElements())
  for (const chart of charts) {
    const id = elementId(`${chart.slide}.${chart.shape}`)
    expect(painted.movables.has(id)).toBe(true)
  }
  const [first] = charts
  if (first === undefined) throw new Error("chart")
  expect(readChartValue(fileChartValue(read.parts, first.part, first.shape) ?? "")?.kind).toBe("pie")
}, 120_000)

it("paints the rest of a deck and names the edit it cannot write, instead of failing", () => {
  const store = paintStore()
  const busy = busyElements()
  const first = paint(store, parts, openRegister("", ""), busy)
  const texts = [...first.files].filter(([, file]) => file.startsWith("[")).map(([node]) => node)
  const [broken, kept] = texts
  if (broken === undefined || kept === undefined) throw new Error("two text layers")
  const outside = writeTextValue([{ from: 40, runs: [{ from: 0, text: "Nowhere" }] }])
  const box = { x: 123_456, y: 234_567, cx: 2_000_000, cy: 1_000_000 }
  const register = person(person(openRegister("", ""), broken, outside), kept, box)
  const painted = paint(paintStore(), parts, register, busy)
  expect(painted.leftOut).toEqual([{ node: broken, row: 0 }])
  const moved = readShapes(painted.display).find((shape) => `${shape.slide}.${shape.shape}` === kept)
  expect(moved?.box).toMatchObject({ x: box.x, y: box.y })
})
