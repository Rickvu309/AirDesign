import {
  decide,
  elementId,
  openRegister,
  writeTextValue,
  type Box,
  type Command,
  type Register,
  type TextValue,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts } from "./export-parts.js"
import { readParts } from "./package-container.js"
import { decodeUtf8, sameBytes } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"
import { readShapes, type ReadShape } from "./read-shapes.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): {
    readFileSync(path: string): Uint8Array
    readdirSync(path: string): readonly string[]
  }
}

type Parts = ReadonlyMap<string, Uint8Array>

const empty = new Uint8Array()

const { readFileSync, readdirSync } = process.getBuiltinModule("node:fs")
const fixtures = `${process.cwd()}/scripts/pptx-fixtures`
const decks = [
  ...readdirSync(fixtures).filter((name) => name.endsWith(".pptx")),
  ...readdirSync(`${fixtures}/corpus`)
    .filter((name) => name.endsWith(".pptx"))
    .map((name) => `corpus/${name}`),
]
const unreadable = new Set(["broken-order.pptx"])
const withoutText = [
  "duplicate-id.pptx",
  "element-removed.pptx",
  "empty.pptx",
  "frame.pptx",
  "nested-groups.pptx",
  "office-chart.pptx",
]

async function deckParts(name: string): Promise<Parts> {
  return readParts(new Uint8Array(readFileSync(`${fixtures}/${name}`)))
}

function landed(register: Register, commands: readonly Command[]): Register {
  return commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision === "refuse") throw new Error(decision.code)
    return decision.register
  }, register)
}

const idOf = (shape: ReadShape) => elementId(`${shape.slide}.${shape.shape}`)

function typed(text: TextValue): string {
  const [first, ...rest] = text
  const runs = first?.runs ?? []
  const edited =
    runs.length === 0
      ? [{ from: -1, text: "edited" }]
      : runs.map((run, at) => (at === 0 ? { ...run, text: `${run.text} edited` } : run))
  return writeTextValue([{ from: first?.from ?? 0, runs: edited }, ...rest])
}

function textEdit(shape: ReadShape): readonly Command[] {
  const node = idOf(shape)
  return [
    { command: "add", node, floor: "", route: "clean" },
    { command: "person", node, value: typed(shape.text) },
  ]
}

function boxEdit(shape: ReadShape): readonly Command[] {
  const node = idOf(shape)
  const box: Box = shape.box ?? { x: 0, y: 0, cx: 914400, cy: 457200 }
  return [
    { command: "add", node, floor: "", route: "clean" },
    { command: "person", node, property: "box", value: { ...box, x: box.x + 12700, cy: box.cy + 6350 } },
  ]
}

const editable = (shape: ReadShape) =>
  shape.kind === "p:sp" && shape.grouped !== true && !shape.locked && shape.text.length > 0

type TextEdit = { readonly shape: ReadShape; readonly register: Register; readonly exported: Parts }

function firstTextEdit(parts: Parts): TextEdit | undefined {
  for (const shape of readShapes(parts).filter(editable)) {
    const register = landed(openRegister("", "clean"), textEdit(shape))
    try {
      return { shape, register, exported: exportParts(parts, register) }
    } catch {
      continue
    }
  }
  return undefined
}

async function textEdits(): Promise<readonly (TextEdit & { readonly name: string; readonly parts: Parts })[]> {
  const edits = []
  const none = []
  for (const name of decks.filter((deck) => !unreadable.has(deck))) {
    const parts = await deckParts(name)
    const edit = firstTextEdit(parts)
    if (edit === undefined) none.push(name)
    else edits.push({ ...edit, name, parts })
  }
  expect(none).toEqual(withoutText)
  return edits
}

describe("exportParts on every fixture and corpus deck", () => {
  it("keeps every part when the register holds no row", async () => {
    for (const name of decks.filter((deck) => !unreadable.has(deck))) {
      const parts = await deckParts(name)
      const exported = exportParts(parts, openRegister("", "clean"))
      for (const [part, bytes] of parts) expect(exported.get(part), `${name} ${part}`).toBe(bytes)
      expect(exported.size, name).toBe(parts.size)
    }
  }, 120_000)

  it("gives the same bytes when the export is exported again with the same rows", async () => {
    for (const { name, parts, shape, register } of await textEdits()) {
      const moving = readShapes(parts).find(
        (each) => each.grouped !== true && each.kind === "p:sp" && idOf(each) !== idOf(shape),
      )
      const both = moving === undefined ? register : landed(register, boxEdit(moving))
      const once = exportParts(parts, both)
      const twice = exportParts(once, both)
      expect(once, name).not.toBe(parts)
      for (const [part, bytes] of once) expect(sameBytes(twice.get(part) ?? empty, bytes), `${name} ${part}`).toBe(true)
      expect(twice.size, name).toBe(once.size)
    }
  }, 120_000)

  it("changes only the edited slide after one text edit, and paints every other element there as before", async () => {
    for (const { name, parts, shape, exported } of await textEdits()) {
      for (const [part, bytes] of parts) {
        if (part !== shape.part) expect(exported.get(part), `${name} ${part}`).toBe(bytes)
      }
      expect(decodeUtf8(exported.get(shape.part) ?? new Uint8Array()), name).toContain("edited</a:t>")
      const others = (from: Parts) =>
        paintReader(from)
          .slide(shape.part)
          .elements.filter((element) => element.from !== "slide" || element.shape !== shape.shape)
      expect(others(exported), name).toEqual(others(parts))
    }
  }, 120_000)
})
