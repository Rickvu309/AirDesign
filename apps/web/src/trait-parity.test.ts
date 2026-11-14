import { readAgent, readSetChange, traitWire } from "@airdesign/catalog"
import {
  decide,
  format,
  formatOne,
  inheritable,
  openRegister,
  planChange,
  registerScope,
  rowOf,
  valueHolder,
  readTableValue,
  readTextValue,
  traitNames,
  traits,
  undoOf,
  writeTableValue,
  type Command,
  type Desc,
  type FieldName,
  type FieldValue,
  type IndexElement,
  type InheritableField,
  type Kind,
  type Register,
  type TextValue,
  type TraitName,
  type Value,
} from "@airdesign/document"
import {
  exportParts,
  indexPackage,
  paintReader,
  readNotes,
  readPackage,
  readSlides,
  readTable,
  shownFill,
} from "@airdesign/pptx"
import { beforeAll, describe, expect, it } from "vitest"
import { optionCopy } from "./copy/option-copy"
import { panelOf } from "./design/panel"
import { traitControls } from "./design/trait-controls"
import { ensureMarkup } from "./markup"

type Parts = ReadonlyMap<string, Uint8Array>

type At = { readonly node: IndexElement["node"]; readonly slide: string; readonly part: string; readonly shape: string }

type FieldProbe<T extends TraitName, F extends FieldName<T>> = {
  readonly file: (parts: Parts, at: At) => unknown
  readonly shows: (value: FieldValue<T, F>) => unknown
} & (F extends InheritableField<T> ? { readonly inherited: (parts: Parts, at: At) => boolean } : unknown)

type Probe<T extends TraitName> = [FieldName<T>] extends [never]
  ? { readonly fields: Readonly<Record<never, never>> }
  : {
      readonly deck: string
      readonly kind: Kind
      readonly opening: (parts: Parts, at: At) => Value
      readonly edit: (opening: Value, field: FieldName<T>, value: FieldValue<T, FieldName<T>>) => Value
      readonly fields: { readonly [F in FieldName<T>]-?: FieldProbe<T, F> }
    }

type Layer = "change" | "wire" | "control" | "round-trip" | "paint-change" | "undo" | "inherit" | "pptx-case"

type Problem = { readonly field: string; readonly missing: Layer } | { readonly word: string; readonly missing: "copy" }

type Case = { readonly covers?: readonly string[] }

const cases = Object.values(
  import.meta.glob<Case>("../../../scripts/pptx-cases/*.mjs", { import: "default", eager: true }),
)

const boxKeys = { x: "x", y: "y", w: "cx", h: "cy" } as const

function words(text: TextValue): string {
  return text.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")
}

function element(parts: Parts, at: At): IndexElement | undefined {
  return indexPackage(parts).elements.find((each) => each.node === at.node)
}

function grid(parts: Parts, at: At): readonly (readonly string[])[] | undefined {
  return readTable(parts, at.part, at.shape)?.rows.map((row) => row.cells.map(words))
}

const probes: { readonly [T in TraitName]: Probe<T> } = {
  identity: { fields: {} },
  geometry: { fields: {} },
  fill: {
    deck: "clean.pptx",
    kind: "shape",
    opening: () => ({ v: format, patch: { fill: { value: "opening" } } }),
    edit: (_, __, value) => ({ v: format, patch: { fill: { value: { set: value } } } }),
    fields: {
      value: {
        file: (parts, at) => shownFill(parts, at)?.value,
        shows: (value) => value,
        inherited: (parts, at) => shownFill(parts, at)?.own === false,
      },
    },
  },
  line: { fields: {} },
  effects: { fields: {} },
  body: { fields: {} },
  image: { fields: {} },
  crop: { fields: {} },
  connection: { fields: {} },
  box: {
    deck: "clean.pptx",
    kind: "shape",
    opening: (parts, at) => ({ property: "box", value: element(parts, at)?.box ?? { x: 0, y: 0, cx: 0, cy: 0 } }),
    edit: (opening, field, value) =>
      opening.property === "box" ? { property: "box", value: { ...opening.value, [boxKeys[field]]: value } } : opening,
    fields: {
      x: { file: (parts, at) => element(parts, at)?.box?.x, shows: (value) => value },
      y: { file: (parts, at) => element(parts, at)?.box?.y, shows: (value) => value },
      w: { file: (parts, at) => element(parts, at)?.box?.cx, shows: (value) => value },
      h: { file: (parts, at) => element(parts, at)?.box?.cy, shows: (value) => value },
    },
  },
  text: {
    deck: "clean.pptx",
    kind: "shape",
    opening: (parts, at) => ({ value: element(parts, at)?.value ?? "" }),
    edit: (_, __, value) => ({ value }),
    fields: {
      value: {
        file: (parts, at) => words(readTextValue(element(parts, at)?.value ?? "") ?? []),
        shows: (value) => words(readTextValue(value) ?? [{ from: 0, runs: [{ from: 0, text: value }] }]),
      },
    },
  },
  notes: {
    deck: "nasa-1d-cnn.pptx",
    kind: "slide",
    opening: (parts, at) => ({ value: readNotes(parts).find((notes) => notes.slide === at.slide)?.text ?? "" }),
    edit: (_, __, value) => ({ value }),
    fields: {
      value: {
        file: (parts, at) => readNotes(parts).find((notes) => notes.slide === at.slide)?.text,
        shows: (value) => value,
      },
    },
  },
  table: {
    deck: "table-added.pptx",
    kind: "table",
    opening: (parts, at) => {
      const table = readTable(parts, at.part, at.shape)
      return { value: table === null ? "" : writeTableValue(table) }
    },
    edit: (_, __, value) => ({ value }),
    fields: {
      value: { file: grid, shows: (value) => readTableValue(value)?.rows.map((row) => row.cells.map(words)) },
    },
  },
}

function fromAgent(desc: Desc, raw: unknown): unknown {
  const read = readAgent(desc, raw)
  return read.ok ? read.value : undefined
}

function optionWords(desc: Desc): readonly string[] {
  switch (desc.kind) {
    case "choice":
      return desc.options
    case "union":
      return Object.entries(desc.cases).flatMap(([name, item]) => [name, ...optionWords(item)])
    case "record":
      return Object.entries(desc.fields).flatMap(([name, item]) => [name, ...optionWords(item)])
    case "list":
    case "named":
      return optionWords(desc.item)
    default:
      return []
  }
}

async function deckParts(name: string): Promise<Parts> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(await fs.readFile(new URL(`../../../scripts/pptx-fixtures/${name}`, import.meta.url)))
  if (!read.ok) throw new Error(read.reason)
  return read.parts
}

function indexed(parts: Parts): Register {
  const index = indexPackage(parts)
  return { ...openRegister("", "clean"), index: { ...index, total: index.elements.length, pages: [] } }
}

function landed(register: Register, commands: readonly Command[]): Register | null {
  let current = register
  for (const command of commands) {
    const decision = decide(current, command)
    if (decision.decision === "refuse") return null
    current = decision.register
  }
  return current
}

function placed(parts: Parts, kind: Kind): At {
  const found = indexPackage(parts).elements.find((each) => each.kind === kind && !each.grouped)
  if (found === undefined) throw new Error(kind)
  const [slide = "", shape = ""] = found.node.split(".")
  const part = readSlides(parts).find((each) => each.slide === slide)?.part ?? ""
  return { node: found.node, slide, part, shape }
}

function agentRegister(register: Register, at: At, example: object): Register | null {
  const read = readSetChange({ op: "set", target: at.node, ...example })
  if (!read.ok) return null
  const opened = landed(register, [
    { command: "add", node: at.node, floor: "", route: "clean" },
    { command: "start", runId: "parity", node: at.node },
  ])
  const planned = opened === null ? null : planChange(read.change, registerScope(opened))
  if (opened === null || planned === null || !planned.ok) return null
  return landed(
    opened,
    planned.rows.map(({ node, row }) => ({ command: "agent", runId: "parity", readAt: 0, node, ...row })),
  )
}

function panelRegister(register: Register, at: At, trait: TraitName, field: string, value: unknown): Register | null {
  const scope = registerScope(register)
  const view = scope.view(at.node)
  const row = view === undefined ? undefined : panelOf(view, { reads: {}, moves: true }).sections
  const control = row?.find((section) => section.trait === trait)?.rows.find((each) => each.field === field)
  const planned = control === undefined ? null : planChange(control.change(value), scope)
  if (planned === null || !planned.ok) return null
  const holder = valueHolder(register, at.node, "person")
  const commands = planned.rows.flatMap(({ node, row: planned }): Command[] =>
    (formatOne(planned.patch, holder) ?? [planned]).map((each) => ({ command: "person", node, ...each })),
  )
  const opened = landed(register, [{ command: "add", node: at.node, floor: "", route: "clean" }])
  return commands.length === 0 || opened === null ? null : landed(opened, commands)
}

function painted(parts: Parts, at: At): string {
  const drawn = paintReader(parts).slide(at.part).elements
  return JSON.stringify(drawn.filter((each) => each.from === "slide" && each.shape === at.shape))
}

function sameParts(left: Parts, right: Parts): boolean {
  if (left.size !== right.size) return false
  return [...left].every(([name, bytes]) => {
    const other = right.get(name)
    return other !== undefined && other.length === bytes.length && other.every((byte, at) => byte === bytes[at])
  })
}

function same(left: unknown, right: unknown): boolean {
  return left !== undefined && JSON.stringify(left) === JSON.stringify(right)
}

type Loose = {
  readonly deck: string
  readonly kind: Kind
  readonly opening: (parts: Parts, at: At) => Value
  readonly edit: (opening: Value, field: string, value: unknown) => Value
  readonly fields: Readonly<
    Record<
      string,
      {
        file: (parts: Parts, at: At) => unknown
        shows: (value: unknown) => unknown
        inherited?: (parts: Parts, at: At) => boolean
      }
    >
  >
}

type LooseWire = {
  readonly description: string
  readonly fields: Readonly<Record<string, { readonly description: string; readonly example: unknown }>>
}

type LooseControls = {
  readonly section: string
  readonly fields: Readonly<Record<string, { readonly label: string; readonly reset?: string }>>
}

async function fieldProblems(
  trait: TraitName,
  field: string,
  probe: Loose,
  wire: Partial<LooseWire>,
): Promise<Problem[]> {
  const key = `${trait}.${field}`
  const desc = (traits[trait].fields as Readonly<Record<string, { readonly desc: Desc }>>)[field]?.desc
  const sent = wire.fields?.[field]?.example as Readonly<Record<string, Readonly<Record<string, unknown>>>> | undefined
  const example = sent?.[trait]?.[field]
  const value = desc === undefined ? undefined : fromAgent(desc, example)
  if (desc === undefined || sent === undefined || value === undefined) return [{ field: key, missing: "wire" }]
  const parts = await deckParts(probe.deck)
  const at = placed(parts, probe.kind)
  const shape = probe.fields[field]
  const opening = probe.opening(parts, at)
  const edit = probe.edit(opening, field, value)
  const shown = (exported: Parts) => shape !== undefined && same(shape.file(exported, at), shape.shows(value))
  const problems: Problem[] = shown(parts) ? [{ field: key, missing: "change" }] : []
  const agent = agentRegister(indexed(parts), at, sent)
  if (agent === null || !shown(exportParts(parts, agent))) problems.push({ field: key, missing: "wire" })
  const panel = panelRegister(indexed(parts), at, trait, field, value)
  if (panel === null || !shown(exportParts(parts, panel))) problems.push({ field: key, missing: "control" })
  const person = landed(indexed(parts), [
    { command: "add", node: at.node, floor: "", route: "clean" },
    { command: "person", node: at.node, ...edit },
  ])
  const exported = person === null ? parts : exportParts(parts, person)
  if (person === null || !shown(exported)) problems.push({ field: key, missing: "round-trip" })
  if (probe.kind !== "slide" && painted(exported, at) === painted(parts, at)) {
    problems.push({ field: key, missing: "paint-change" })
  }
  const holder = trait === "notes" || trait === "table" ? trait : "text"
  const step = { node: at.node, before: rowOf(opening, holder).patch, after: rowOf(edit, holder).patch }
  const turn = person === null ? null : undoOf(person, { steps: [step] })
  const undone = person === null || turn === null || !turn.ok ? null : landed(person, turn.commands)
  if (undone === null || !sameParts(exportParts(parts, undone), parts)) problems.push({ field: key, missing: "undo" })
  if (inheritable(trait, field)) {
    const reset = panelRegister(indexed(parts), at, trait, field, null)
    const back = reset === null ? parts : exportParts(parts, reset)
    if (shape?.inherited === undefined || !shape.inherited(back, at) || shape.inherited(parts, at))
      problems.push({ field: key, missing: "inherit" })
  }
  if (!cases.some((each) => each.covers?.includes(key))) problems.push({ field: key, missing: "pptx-case" })
  return problems
}

async function inputProblems(
  trait: TraitName,
  input: string,
  probe: Loose,
  wire: Partial<LooseWire>,
): Promise<Problem[]> {
  const key = `${trait}.${input}`
  const example = wire.fields?.[input]?.example
  if (example === undefined) return [{ field: key, missing: "wire" }]
  const parts = await deckParts(probe.deck)
  const at = placed(parts, probe.kind)
  const agent = agentRegister(indexed(parts), at, example as object)
  if (agent === null) return [{ field: key, missing: "wire" }]
  const desc = (traits[trait].inputs as Readonly<Record<string, { readonly desc: Desc }>>)[input]?.desc
  const sent = (example as Readonly<Record<string, Readonly<Record<string, unknown>>>>)[trait]?.[input]
  const value = desc === undefined ? undefined : fromAgent(desc, sent)
  const panel = value === undefined ? null : panelRegister(indexed(parts), at, trait, input, value)
  const problems: Problem[] = []
  if (panel === null || painted(exportParts(parts, panel), at) === painted(parts, at))
    problems.push({ field: key, missing: "control" })
  if (painted(exportParts(parts, agent), at) === painted(parts, at))
    problems.push({ field: key, missing: "paint-change" })
  return problems
}

function copyProblems(trait: TraitName, controls: Partial<LooseControls>, wire: Partial<LooseWire>): Problem[] {
  const fields = [
    ...Object.entries(traits[trait].fields as Readonly<Record<string, { readonly desc: Desc }>>),
    ...Object.entries(traits[trait].inputs as Readonly<Record<string, { readonly desc: Desc }>>),
  ]
  const wanted = [
    [`${trait} section`, controls.section],
    [`${trait} description`, wire.description],
    ...fields.flatMap(([field, kind]) => [
      [`${trait}.${field} label`, controls.fields?.[field]?.label],
      ...(inheritable(trait, field) ? [[`${trait}.${field} reset`, controls.fields?.[field]?.reset]] : []),
      [`${trait}.${field} description`, wire.fields?.[field]?.description],
      ...optionWords(kind.desc).map((word) => [`option ${word}`, optionCopy[word]]),
    ]),
  ]
  return wanted
    .filter(([, words]) => (words ?? "").trim() === "")
    .map(([word]) => ({ word: word ?? "", missing: "copy" }))
}

async function parityProblems(): Promise<readonly Problem[]> {
  const problems: Problem[] = []
  for (const trait of traitNames) {
    if (Object.keys(traits[trait].fields).length === 0) continue
    const probe = probes[trait] as Loose
    const wire = traitWire[trait] as Partial<LooseWire>
    problems.push(...copyProblems(trait, traitControls[trait] as Partial<LooseControls>, wire))
    for (const field of Object.keys(traits[trait].fields))
      problems.push(...(await fieldProblems(trait, field, probe, wire)))
    for (const input of Object.keys(traits[trait].inputs))
      problems.push(...(await inputProblems(trait, input, probe, wire)))
  }
  return problems
}

const agentRefused = (problem: Problem) =>
  "field" in problem && problem.field === "table.value" && problem.missing === "wire"

let found: readonly Problem[] = []

beforeAll(async () => {
  await ensureMarkup()
  found = await parityProblems()
}, 120_000)

describe("every live trait field reaches every layer", () => {
  it("lands each field's example as an agent and as a person, exports it, reads it, paints it, undoes it and judges it", () => {
    expect(found.filter((problem) => !agentRefused(problem))).toEqual([])
  })

  it.fails("lets an agent set a table's cells", () => {
    expect(found.filter(agentRefused)).toEqual([])
  })

  it("walks every option and case word of a field's kind for its copy", () => {
    const desc: Desc = {
      kind: "union",
      cases: { none: { kind: "mark" }, preset: { kind: "choice", options: ["dash", "dot"] } },
      plain: "preset",
    }
    expect(optionWords(desc)).toEqual(["none", "preset", "dash", "dot"])
  })
})
