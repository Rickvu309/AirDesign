import {
  changedTable,
  decide,
  elementId,
  openRegister,
  writeTableValue,
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
import { readTable } from "./table-write.js"

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
const withoutText = ["duplicate-id.pptx", "element-removed.pptx", "empty.pptx"]

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

function gridOfPart(
  parts: Parts,
  part: string,
): { readonly widths: readonly number[]; readonly heights: readonly number[] } {
  const xml = decodeUtf8(parts.get(part) ?? empty)
  return {
    widths: [...xml.matchAll(/<a:gridCol w="(\d+)"/g)].map((match) => Number(match[1])),
    heights: [...xml.matchAll(/<a:tr h="(\d+)"/g)].map((match) => Number(match[1])),
  }
}

describe("exportParts on a table", () => {
  async function opened() {
    const parts = await deckParts("table-added.pptx")
    const table = readShapes(parts).find((shape) => shape.contentKind === "table")
    if (table === undefined || table.box === null) throw new Error("table")
    const read = readTable(parts, table.part, table.shape)
    if (read === null) throw new Error("table value")
    const node = idOf(table)
    const exported = (commands: readonly Command[]) => {
      const next = exportParts(
        parts,
        landed(openRegister("", "clean"), [{ command: "add", node, floor: "", route: "clean" }, ...commands]),
      )
      const shape = readShapes(next).find((each) => each.slide === table.slide && each.shape === table.shape)
      return { parts: next, box: shape?.box, grid: gridOfPart(next, table.part) }
    }
    const column = changedTable(read, { change: "column", column: 2, place: "after" })
    if (column === null) throw new Error("column")
    return { parts, table, box: table.box, node, read, exported, column: writeTableValue(column) }
  }

  it("writes a person's table value and moves the frame", async () => {
    const { table, box, node, read, exported } = await opened()
    const changed = changedTable(read, { change: "cell", row: 0, column: 0, text: "Typed" })
    if (changed === null) throw new Error("table value")
    const done = exported([
      { command: "person", node, value: writeTableValue(changed) },
      { command: "person", node, property: "box", value: { ...box, x: 12700, y: 25400 } },
    ])
    expect(done.box).toEqual({ ...box, x: 12700, y: 25400 })
    expect(decodeUtf8(done.parts.get(table.part) ?? empty)).toContain("<a:t>Typed</a:t>")
  })

  it("leaves the columns and rows byte for byte when a box only moves the table", async () => {
    const { parts, table, box, node, exported } = await opened()
    const done = exported([{ command: "person", node, property: "box", value: { ...box, x: 12700 } }])
    const before = decodeUtf8(parts.get(table.part) ?? empty)
    const after = decodeUtf8(done.parts.get(table.part) ?? empty)
    expect(after.slice(after.indexOf("<a:tbl>"))).toBe(before.slice(before.indexOf("<a:tbl>")))
  })

  it("scales every column and row by the frame's new size, as PowerPoint does", async () => {
    const { box, node, exported } = await opened()
    expect(box).toMatchObject({ cx: 7_315_200, cy: 1_112_520 })
    const done = exported([
      { command: "person", node, property: "box", value: { ...box, cx: 9_144_000, cy: 1_668_780 } },
    ])
    expect(done.box).toEqual({ ...box, cx: 9_144_000, cy: 1_668_780 })
    expect(done.grid).toEqual({ widths: [3_048_000, 3_048_000, 3_048_000], heights: [556_260, 556_260, 556_260] })
  })

  it("keeps the width a person dragged to after adding a column, and a later move keeps it too", async () => {
    const { box, node, exported, column } = await opened()
    const dragged = exported([
      { command: "person", node, value: column },
      { command: "person", node, property: "box", value: { ...box, cx: 4_876_800 } },
    ])
    expect(dragged.box?.cx).toBe(4_876_800)
    expect(dragged.grid.widths).toEqual([1_219_200, 1_219_200, 1_219_200, 1_219_200])
    const moved = exported([
      { command: "person", node, value: column },
      { command: "person", node, property: "box", value: { ...box, x: 12700, cx: 9_753_600 } },
    ])
    expect(moved.box).toEqual({ ...box, x: 12700, cx: 9_753_600 })
    expect(moved.grid.widths).toEqual([2_438_400, 2_438_400, 2_438_400, 2_438_400])
  })

  it("widens a resized table by its new column when the column comes after the resize", async () => {
    const { box, node, exported, column } = await opened()
    const done = exported([
      { command: "person", node, property: "box", value: { ...box, cx: 3_657_600 } },
      { command: "person", node, value: column },
    ])
    expect(done.box?.cx).toBe(4_876_800)
    expect(done.grid.widths).toEqual([1_219_200, 1_219_200, 1_219_200, 1_219_200])
  })
})
