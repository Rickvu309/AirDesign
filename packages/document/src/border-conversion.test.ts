import { describe, expect, it } from "vitest"
import { answeredRegister } from "./answered-register.js"
import { borderElement, borderRow } from "./border-conversion.js"
import { readIndexPage, type IndexElement } from "./deck-index.js"
import type { Register } from "./decide.js"
import { format } from "./format.js"
import written from "./format-58-deck.json" with { type: "json" }
import { record } from "./plain-object.js"
import { readSlideState } from "./slide-order.js"
import { readRegister, readRow } from "./stored.js"

const borderFormat = 64

type Stored = { readonly v?: number; readonly patch?: Readonly<Record<string, unknown>> }

function readDeck(): Register {
  const read = readRegister(written.register, written.index)
  if (!read.ok) throw new Error(read.refusal)
  return read.value
}

function storedRows(node: string): readonly Stored[] {
  const elements: Readonly<Record<string, { readonly landed: readonly Stored[] }>> = written.register.elements
  return elements[node]?.landed ?? []
}

function patches(register: Register, node: string): readonly unknown[] {
  return (register.elements[node as keyof Register["elements"]]?.landed ?? []).map((row) =>
    row.v === undefined ? row : { v: row.v, patch: row.patch },
  )
}

function renamed(rows: readonly Stored[]): readonly unknown[] {
  return rows.map(({ patch = {} }) => ({
    v: borderFormat,
    patch: Object.fromEntries(
      Object.entries(patch).map(([trait, fields]) => [trait === "line" ? "border" : trait, fields]),
    ),
  }))
}

function floors(register: Register): readonly IndexElement[] {
  return register.order.flatMap((command) => {
    if (command.slide === "clone") return command.floor ?? []
    if (command.slide === "clone-many") return command.copies.flatMap((copy) => copy.floor ?? [])
    return []
  })
}

type Keyed = { readonly design?: object; readonly opening?: object }

function keysOf(elements: readonly Keyed[], part: "design" | "opening"): readonly string[] {
  return elements.flatMap((element) => Object.keys(element[part] ?? {}))
}

describe("a deck a format 58 build saved", () => {
  it("reads every row that build wrote under line as the same row under border", () => {
    const register = readDeck()
    for (const node of ["256.2", "256.3", "256.4", "256.5"]) {
      expect(storedRows(node).every((row) => Object.keys(row.patch ?? {}).includes("line"))).toBe(true)
      expect(patches(register, node)).toEqual(renamed(storedRows(node)))
    }
    expect(patches(register, "256.5")).toEqual([
      {
        v: borderFormat,
        patch: {
          border: {
            dash: { set: "sysDot" },
            fill: { set: { solid: { scheme: "accent2" } } },
            head: { set: { type: "oval", width: "lg", length: "sm" } },
            tail: { set: { type: "stealth", width: "lg", length: "lg" } },
            width: { set: 38_100 },
            compound: { set: "dbl" },
          },
        },
      },
    ])
    expect(patches(register, "256.3")[2]).toEqual({
      v: borderFormat,
      patch: { border: { dash: "opening", fill: "opening" } },
    })
  })

  it("reads the floors of every duplicated slide, a person's and an agent's, with border openings and border design", () => {
    const stored = written.register.order.flatMap((command): readonly Keyed[] =>
      "copies" in command
        ? command.copies.flatMap((copy): readonly Keyed[] => copy.floor)
        : "floor" in command
          ? command.floor
          : [],
    )
    const floor = floors(readDeck())
    expect(floor).toHaveLength(stored.length)
    const lineOpenings = stored.filter((element) => Object.hasOwn(element.opening ?? {}, "line")).length
    expect(lineOpenings).toBe(24)
    expect(floor.filter((element) => element.opening?.border !== undefined)).toHaveLength(lineOpenings)
    expect(keysOf(floor, "opening")).not.toContain("line")
    const lineDesign = keysOf(stored, "design").filter((key) => key.startsWith("line."))
    expect(lineDesign).toHaveLength(12)
    expect(keysOf(floor, "design").filter((key) => key.startsWith("border."))).toEqual(
      lineDesign.map((key) => `border.${key.slice("line.".length)}`),
    )
    const clone = readDeck().order.find((command) => command.slide === "clone")
    const copy = clone?.slide === "clone" ? clone.floor?.find((element) => element.node.endsWith(".5")) : undefined
    expect(copy?.opening?.border?.compound).toEqual({ set: "dbl" })
  })

  it("reads the stored index's design under border and keeps the index's format", () => {
    const index = readDeck().index
    const elements = index?.elements ?? []
    expect(elements).toHaveLength(written.index.elements.length)
    expect(keysOf(elements, "design").filter((key) => key.startsWith("border."))).toEqual(
      keysOf(written.index.elements, "design")
        .filter((key) => key.startsWith("line."))
        .map((key) => `border.${key.slice("line.".length)}`),
    )
    expect(keysOf(elements, "design").filter((key) => key.startsWith("line."))).toEqual([])
    expect(index?.format).toBe(written.format)
  })

  it("answers an older tab that this deck is newer than it, from its rows, its floors or its index alone", () => {
    const register = readDeck()
    expect(answeredRegister(register).format).toBe(format)
    const { index: _index, ...indexless } = register
    expect(answeredRegister({ ...register, elements: {}, order: [] }).format).toBe(format)
    expect(answeredRegister({ ...indexless, elements: {} }).format).toBe(format)
  })
})

describe("what a format 58 device kept", () => {
  const entries = written.device.entries.map((entry) => record(entry.value) ?? {})

  it("reads its confirmed and pending rows under border", () => {
    const rows = entries.flatMap((entry) => {
      if (!("patch" in entry)) return []
      const read = readRow(entry, "text")
      if (!read.ok) throw new Error(read.refusal)
      return [read.value]
    })
    expect(rows).toHaveLength(10)
    expect(rows.every((row) => Object.keys(row.patch).includes("border"))).toBe(true)
    expect(rows.at(-1)).toEqual({
      v: borderFormat,
      patch: { border: { fill: { set: { solid: { scheme: "tx1" } } }, dash: { set: "dot" } } },
    })
  })

  it("reads its confirmed slide duplicates with border openings", () => {
    const edits = entries.filter((entry) => "slideEdit" in entry)
    expect(edits).toHaveLength(4)
    for (const entry of edits) {
      const state = readSlideState({ file: entry.slideFile, order: [entry.slideEdit] })
      expect(state).toBeDefined()
      expect(JSON.stringify(state?.order)).not.toContain('"line')
      expect(JSON.stringify(state?.order)).toContain('"border":{')
    }
  })

  it("reads its cached index page with border design", () => {
    const page = readIndexPage(entries.find((entry) => entry.once !== undefined && "elements" in entry))
    expect(page?.format).toBe(written.format)
    const keys = (page?.elements ?? []).flatMap((element) => Object.keys(element.design ?? {}))
    expect(keys.filter((key) => key.startsWith("border."))).toHaveLength(6)
    expect(keys.filter((key) => key.startsWith("line."))).toEqual([])
  })
})

describe("one name for the border", () => {
  it("refuses a row or an opening that names the border both ways", () => {
    const both = { v: 58, patch: { line: { width: { set: 1 } }, border: { dash: { set: "dot" } } } }
    expect(borderRow(both)).toBeNull()
    expect(readRow(both, "text")).toEqual({ ok: false, refusal: "payload" })
    expect(borderElement({ node: "256.2", opening: both.patch })).toBeNull()
  })

  it("hands back a row and an element with no line as the same value", () => {
    const plain = { v: 58, patch: { box: { x: { set: 1 } } } }
    expect(borderRow(plain)).toBe(plain)
    const element = { node: "256.2", design: { fills: ["accent1"] }, opening: plain.patch }
    expect(borderElement(element)).toBe(element)
  })
})
