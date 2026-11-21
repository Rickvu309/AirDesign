import { readDeckId, toolInputSchema, traitWire } from "@airdesign/catalog"
import { presentSlides, readRegister, type Kind, type Register, type TraitName } from "@airdesign/document"
import { callTool, emptyLog, memoryTurns, type Session } from "@airdesign/mcp"
import { describe, expect, it } from "vitest"
import { exportedParts } from "@/exported-parts"
import { indexedParts } from "@/index-deck"
import { deckParts, indexed, placed, type Parts } from "@/parity-probe"
import { probes } from "@/trait-probes"
import { samples, variations, type Places } from "./accepted-inputs"

type Schema = Readonly<Record<string, unknown>>

const schema = toolInputSchema("edit_deck") as Schema
const defs = (schema.$defs ?? {}) as Readonly<Record<string, Schema>>
const branches = ((schema.properties as Readonly<Record<string, Schema>>).changes?.items as Schema)
  .anyOf as readonly Schema[]
const branch = (op: string) =>
  branches.find(
    (each) => ((each.properties as Readonly<Record<string, Schema>> | undefined)?.op?.const ?? "") === op,
  ) ?? {}
const propertiesOf = (op: string) => (branch(op).properties ?? {}) as Readonly<Record<string, Schema>>

function session(register: Register): Session {
  const deck = readDeckId("deck")
  if (!deck.ok) throw new Error("deck")
  return {
    caller: { actor: "agent", runId: "agent" },
    deck: { id: deck.deck, revision: 0, register },
    log: emptyLog(),
    now: 0,
    turns: memoryTurns(),
  }
}

function sent(at: Session, changes: readonly unknown[]): Register | null {
  const result = callTool("airdesign_edit_deck", { deck: "deck", base: at.deck.revision, changes }, at)
  if (!result.ok) return null
  at.deck = result.deck
  return result.deck.register
}

function unwritable(parts: Parts, register: Register): string | null {
  const stored = readRegister(JSON.parse(JSON.stringify(register)))
  if (!stored.ok) return `store reader: ${stored.refusal}`
  try {
    exportedParts(parts, stored.value)
    return null
  } catch (error) {
    return `tab writer: ${String(error instanceof Error ? error.message : error)}`
  }
}

type Tried = { readonly sent: number; readonly landed: number; readonly faults: readonly string[] }

function tried(parts: Parts, start: () => Session, changes: readonly unknown[]): Tried {
  let landed = 0
  const faults: string[] = []
  for (const change of changes) {
    const at = start()
    const register = sent(at, [change])
    if (register === null) continue
    landed += 1
    const fault = unwritable(parts, register)
    if (fault !== null) faults.push(`${fault}: ${JSON.stringify(change)}`)
  }
  return { sent: changes.length, landed, faults }
}

const setFields = Object.keys(propertiesOf("set")).filter((name) => name !== "op" && name !== "target")

function examplesOf(field: string): readonly unknown[] {
  if (!Object.hasOwn(traitWire, field)) return []
  const fields = traitWire[field as TraitName].fields as Readonly<Record<string, { readonly example: object }>>
  return Object.values(fields).map(({ example }) => (example as Readonly<Record<string, unknown>>)[field])
}

function opened(parts: Parts): Register {
  const index = indexedParts(parts)
  return { ...indexed(parts), index: { ...index, format: 2, total: index.elements.length, pages: [] } }
}

const chartValue = JSON.stringify({ kind: "bar", categories: ["Jul"], series: [{ name: "Plan", values: [1] }] })

async function setTried(field: string): Promise<Tried> {
  const trait = (field === "opacity" || field === "stack" ? "text" : field) as TraitName
  const probe = probes[trait] as { readonly deck: string; readonly kind: Kind; readonly node?: string }
  const parts = await deckParts(probe.deck)
  let register = opened(parts)
  let places: Places
  if (probe.kind === "chart") {
    const slide = register.index?.slides[0]?.id ?? ""
    const at = session(register)
    const added = sent(at, [{ op: "add", kind: "chart", slide, chart: { value: chartValue } }])
    if (added === null) throw new Error("chart add")
    register = added
    places = {
      slide,
      node:
        register.order.flatMap((command) => (command.slide === "element-add" ? [command.element.node] : []))[0] ?? "",
    }
  } else {
    const at = placed(parts, probe.kind, probe.node)
    places = { slide: at.slide, node: at.node }
  }
  const property = propertiesOf("set")[field] ?? {}
  const values = [
    ...samples(property, defs, places, field),
    ...examplesOf(field).flatMap((example) => variations(example, property, defs, places, field)),
  ]
  const unique = [...new Map(values.map((value) => [JSON.stringify(value), value])).values()]
  const base = register
  return tried(
    parts,
    () => session(base),
    unique.map((value) => ({ op: "set", target: places.node, [field]: value })),
  )
}

async function addTried(onAddedSlide: boolean): Promise<Tried> {
  const parts = await deckParts("blank.pptx")
  const start = opened(parts)
  const first = start.index?.slides[0]?.id ?? ""
  const grown = session(start)
  const register = onAddedSlide ? sent(grown, [{ op: "add_slide", after: first, layout: first }]) : start
  if (register === null) throw new Error("add_slide")
  const slide = presentSlides(register).at(-1)?.id ?? first
  const places: Places = { slide, node: `${slide}.2` }
  const add = propertiesOf("add")
  const kinds = samples(add.kind ?? {}, defs, places, "kind") as readonly string[]
  const takes: Readonly<Record<string, readonly string[]>> = {
    shape: ["box", "text", "fills", "geometry", "border", "body", "icon"],
    line: ["box", "border", "connection"],
    arrow: ["box", "border", "connection"],
    elbow: ["box", "border", "connection"],
    table: ["box", "table"],
    chart: ["box", "chart"],
  }
  const valuesOf = (name: string) => {
    const values = [
      ...samples(add[name] ?? {}, defs, places, name),
      ...examplesOf(name).flatMap((example) => variations(example, add[name] ?? {}, defs, places, name)),
    ]
    return [...new Map(values.map((value) => [JSON.stringify(value), value])).values()]
  }
  const changes = kinds.flatMap((kind) =>
    (takes[kind] ?? []).flatMap((name) => valuesOf(name).map((value) => ({ op: "add", kind, slide, [name]: value }))),
  )
  return tried(parts, () => session(register), changes)
}

describe("every input the agent tools accept, the store reads back and the tab writes", () => {
  it.each(setFields)("op: set %s", async (field) => {
    const result = await setTried(field)
    expect(result.landed).toBeGreaterThan(0)
    expect(result.faults).toEqual([])
  })

  it.each([false, true])("op: add (on a slide the agent added: %s)", { timeout: 120_000 }, async (onAddedSlide) => {
    const result = await addTried(onAddedSlide)
    expect(result.landed).toBeGreaterThan(0)
    expect(result.faults).toEqual([])
  })
})

it.each(["shape", "table"])("op: set on a %s the agent added", { timeout: 60_000 }, async (kind) => {
  const parts = await deckParts("blank.pptx")
  const start = opened(parts)
  const slide = start.index?.slides[0]?.id ?? ""
  const at = session(start)
  const added = sent(at, [
    kind === "table"
      ? {
          op: "add",
          kind,
          slide,
          table: {
            value: JSON.stringify({ rows: [{ from: 0, cells: [[{ from: 0, runs: [{ from: 0, text: "A" }] }]] }] }),
          },
        }
      : { op: "add", kind, slide, text: { value: "One" } },
  ])
  if (added === null) throw new Error("add")
  const node =
    added.order.flatMap((command) => (command.slide === "element-add" ? [command.element.node] : []))[0] ?? ""
  const field = kind === "table" ? "table" : "text"
  const values = samples(propertiesOf("set")[field] ?? {}, defs, { slide, node }, field)
  const result = tried(
    parts,
    () => session(added),
    values.map((value) => ({ op: "set", target: node, [field]: value })),
  )
  expect(result.landed).toBeGreaterThan(0)
  expect(result.faults).toEqual([])
})
