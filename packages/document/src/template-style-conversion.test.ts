import { describe, expect, it } from "vitest"
import { answeredRegister } from "./answered-register.js"
import { readIndexPage, type IndexElement } from "./deck-index.js"
import type { Register } from "./decide.js"
import { format } from "./format.js"
import written from "./format-64-deck.json" with { type: "json" }
import { record } from "./plain-object.js"
import { readSlideState } from "./slide-order.js"
import { readRegister, readRow, readStoredEdit } from "./stored.js"
import { templateStyleElement, templateStyleIndex, templateStyleRow } from "./template-style-conversion.js"

const styleFormat = 68

type Stored = { readonly v?: number; readonly patch?: Readonly<Record<string, unknown>> }

const renamedNodes: Readonly<Record<string, string>> = {
  "deck.theme": "deck.templateStyles",
  "deck.template1": "deck.templateStyle1",
  "deck.template2": "deck.templateStyle2",
}

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
  return (register.elements[node as keyof Register["elements"]]?.landed ?? []).map((row) => ({
    v: row.v,
    patch: "patch" in row ? row.patch : undefined,
  }))
}

function renamed(rows: readonly Stored[]): readonly unknown[] {
  return rows.map(({ patch = {} }) => ({
    v: styleFormat,
    patch: Object.fromEntries(
      Object.entries(patch).map(([trait, fields]) => [
        trait === "theme" || trait === "template" ? "templateStyle" : trait,
        fields,
      ]),
    ),
  }))
}

function floors(register: { readonly order: Register["order"] }): readonly IndexElement[] {
  return register.order.flatMap((command) => {
    if (command.slide === "clone") return command.floor ?? []
    if (command.slide === "clone-many") return command.copies.flatMap((copy) => copy.floor ?? [])
    return []
  })
}

describe("a deck a format 64 build saved", () => {
  it("reads every template style row on its node's new name, and every slide's choice under templateStyle", () => {
    const register = readDeck()
    for (const [old, node] of Object.entries(renamedNodes)) {
      expect(storedRows(old).length).toBeGreaterThan(0)
      expect(patches(register, node)).toEqual(renamed(storedRows(old)))
      expect(register.elements[old as keyof Register["elements"]]).toBeUndefined()
    }
    for (const node of ["256.slide", "2796.slide"]) {
      expect(storedRows(node).every((row) => Object.keys(row.patch ?? {}).includes("template"))).toBe(true)
      expect(patches(register, node)).toEqual(renamed(storedRows(node)))
    }
    expect(patches(register, "deck.templateStyles")).toEqual([
      { v: styleFormat, patch: { templateStyle: { accent3: { set: "7030A0" } } } },
    ])
    expect(register.nodes).toEqual(written.register.nodes.map((node) => renamedNodes[node] ?? node))
    expect(JSON.stringify(register.elements)).not.toMatch(/"(theme|template)":/)
  })

  it("reads the floors of every duplicated slide, a person's and an agent's, with templateStyle openings", () => {
    const stored = floors(written.register as unknown as Register)
    const floor = floors(readDeck())
    expect(floor).toHaveLength(stored.length)
    const chosen = stored.filter((element) => Object.hasOwn(element.opening ?? {}, "template"))
    expect(chosen).toHaveLength(4)
    expect(floor.filter((element) => element.opening?.templateStyle !== undefined)).toEqual(
      chosen.map(({ opening, ...element }) => {
        const { template, ...rest } = opening as Readonly<Record<string, unknown>>
        return { ...element, opening: { ...rest, templateStyle: template } }
      }),
    )
  })

  it("reads the stored index's template styles and each slide's under their new keys, and keeps its format", () => {
    const index = readDeck().index
    expect(index?.templateStyles).toEqual(written.index.templates)
    expect(index?.slides.map((slide) => slide.templateStyle)).toEqual(
      written.index.slides.map((slide) => slide.template),
    )
    expect(JSON.stringify(index)).not.toMatch(/"templates?":/)
    expect(index?.format).toBe(written.format)
  })

  it("answers an older tab that this deck is newer than it, from its rows, its floors, its index or its nodes alone", () => {
    const register = readDeck()
    expect(answeredRegister(register).format).toBe(format)
    const { index: _index, ...indexless } = register
    const none = { ...indexless, order: [] }
    expect(answeredRegister({ ...register, elements: {}, order: [] }).format).toBe(format)
    expect(answeredRegister({ ...indexless, elements: {} }).format).toBe(format)
    const opened = Object.fromEntries(
      Object.entries(register.elements).map(([node, body]) => [node, { ...body, landed: [] }]),
    )
    expect(answeredRegister({ ...none, elements: opened }).format).toBe(format)
    expect(answeredRegister({ ...none, elements: {} }).format).toBeUndefined()
  })
})

describe("what a format 64 device kept", () => {
  const entries = written.device.entries.map((entry) => record(entry.value) ?? {})

  it("reads its confirmed and pending rows under templateStyle and on the new node names", () => {
    const rows = entries.flatMap((entry) => {
      if (!("patch" in entry)) return []
      const read = readStoredEdit({ format: entry.v, node: entry.node, value: entry })
      if (!read.ok || "edits" in read.value) throw new Error("row")
      return [{ node: read.value.node, row: read.value.value }]
    })
    expect(rows).toHaveLength(11)
    expect(rows.every(({ row }) => "patch" in row && Object.keys(row.patch).includes("templateStyle"))).toBe(true)
    expect(rows.map(({ node }) => node).filter((node) => node?.startsWith("deck."))).toEqual([
      "deck.templateStyle1",
      "deck.templateStyle1",
      "deck.templateStyle1",
      "deck.templateStyle1",
      "deck.templateStyle2",
      "deck.templateStyle2",
      "deck.templateStyle2",
      "deck.templateStyles",
      "deck.templateStyle2",
    ])
    expect(rows.at(-1)?.row).toEqual({ v: styleFormat, patch: { templateStyle: { accent4: { set: "123456" } } } })
  })

  it("reads its confirmed slide duplicates with templateStyle openings", () => {
    const edits = entries.filter((entry) => "slideEdit" in entry)
    expect(edits).toHaveLength(3)
    for (const entry of edits) {
      const state = readSlideState({ file: entry.slideFile, order: [entry.slideEdit] })
      expect(floors({ order: state?.order ?? [] }).some((element) => element.opening?.templateStyle)).toBe(true)
      expect(JSON.stringify(state?.order)).not.toContain('"template":')
    }
  })

  it("reads its cached index page with the template styles under their new keys", () => {
    const kept = entries.find((entry) => entry.once !== undefined && "elements" in entry)
    const page = readIndexPage(kept)
    expect(page?.format).toBe(written.format)
    expect(page?.templateStyles).toEqual(kept?.templates)
    expect(page?.slides.map((slide) => slide.templateStyle)).toEqual(
      (kept?.slides as readonly { readonly template?: string }[]).map((slide) => slide.template),
    )
  })

  it("reads each row its journal kept for an unsent change on the new names", () => {
    const journal = JSON.parse(written.device.journal) as readonly Readonly<Record<string, unknown>>[]
    const read = journal.map((entry) =>
      readStoredEdit({ format: entry.format, node: entry.node, floor: entry.floor, value: entry.row }),
    )
    expect(read.map((each) => (each.ok && "node" in each.value ? [each.value.node, each.value.value] : each))).toEqual([
      ["deck.templateStyle2", { v: styleFormat, patch: { templateStyle: { accent4: { set: "123456" } } } }],
      ["deck.templateStyles", { v: styleFormat, patch: { templateStyle: { accent5: { set: "0070C0" } } } }],
      ["2726.slide", { v: styleFormat, patch: { templateStyle: { id: { set: "ppt/theme/theme1.xml" } } } }],
    ])
  })
})

describe("one name for the template style", () => {
  it("refuses a row, an opening, an index or a slide that names it two ways", () => {
    const both = { v: 64, patch: { theme: { dk1: { set: "000000" } }, templateStyle: { dk2: { set: "111111" } } } }
    expect(templateStyleRow(both)).toBeNull()
    expect(readRow(both, "text")).toEqual({ ok: false, refusal: "payload" })
    const twice = { v: 64, patch: { theme: { dk1: { set: "000000" } }, template: { id: { set: "a" } } } }
    expect(readRow(twice, "text")).toEqual({ ok: false, refusal: "payload" })
    expect(templateStyleElement({ node: "256.slide", opening: { template: {}, templateStyle: {} } })).toBeNull()
    expect(templateStyleIndex({ templates: [], templateStyles: [], slides: [] })).toBeNull()
    expect(templateStyleIndex({ slides: [{ id: "256", template: "a", templateStyle: "a" }] })).toBeNull()
  })

  it("refuses a register that holds a node under its old and its new name", () => {
    const body = written.register.elements["deck.theme"]
    const doubled = { ...written.register, elements: { ...written.register.elements, "deck.templateStyles": body } }
    expect(readRegister(doubled, written.index)).toEqual({ ok: false, refusal: "payload" })
  })

  it("hands back a row, an element and an index that already say templateStyle as the same value", () => {
    const plain = { v: styleFormat, patch: { templateStyle: { id: { set: "ppt/theme/theme1.xml" } } } }
    expect(templateStyleRow(plain)).toBe(plain)
    const element = { node: "256.slide", opening: plain.patch }
    expect(templateStyleElement(element)).toBe(element)
    const index = { templateStyles: [], slides: [{ id: "256", templateStyle: "a" }] }
    expect(templateStyleIndex(index)).toBe(index)
  })
})
