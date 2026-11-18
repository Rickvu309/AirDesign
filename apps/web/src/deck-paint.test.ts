import {
  decide,
  elementId,
  format,
  openRegister,
  templateStylesNode,
  writeTextValue,
  type Box,
  type Command,
  type Register,
} from "@airdesign/document"
import { readPackage, readParts, readShapes } from "@airdesign/pptx"
import { paintStore, type PaintStore } from "@airdesign/render"
import { beforeAll, expect, it } from "vitest"
import { paint } from "./deck-paint"
import { elementCommand, removals } from "./element-edit"
import { busyElements, shownValue } from "./live-repaint"
import { pictureCommand } from "./picture-add"
import { fileSlides } from "./slide-edit"
import { tableValue } from "./table-edit"

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
    [4, (before) => changed(before, { change: "table", index: 4, size: room, rows: 3, columns: 3 })],
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

const tableNode = elementId("256.4")

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

it("paints the rows and columns a person changed in a table the deck was imported with", async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const columns = await readParts(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/table-columns.pptx", import.meta.url)),
  )
  const shape = readShapes(columns).find((each) => each.shape === "4")!
  let register = landed(openRegister("", "deck"), { command: "add", node: tableNode, floor: "", route: "" })
  for (const change of [
    { change: "remove-column", column: 1 },
    { change: "remove-row", row: 0 },
  ] as const)
    register = landed(register, {
      command: "person",
      node: tableNode,
      value: tableValue(columns, shape, shownValue(register, tableNode, ""), change)!,
    })
  const painted = paint(paintStore(), columns, register, busyElements())
  const table = painted.canvases(0)?.elements.find((element) => element.id === tableNode)?.table
  expect(table?.columns).toHaveLength(3)
  expect(table?.rows).toHaveLength(3)
})

it("paints a slide's typed title in the theme's new heading font, as it paints an untouched slide", () => {
  const typed = person(openRegister("", "doe"), "256.2", "Heat pumps")
  const opened = decide(typed, { command: "add", node: templateStylesNode, floor: "", route: "doe" })
  if (opened.decision === "refuse") throw new Error(opened.code)
  const patch = { theme: { major: { set: "Georgia" } } }
  const themed = decide(opened.register, { command: "person", node: templateStylesNode, v: format, patch })
  if (themed.decision === "refuse") throw new Error(themed.code)
  const painted = paint(paintStore(), parts, themed.register, busyElements())
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
