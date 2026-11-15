import { readAgent, traitWire } from "@airdesign/catalog"
import {
  format,
  formatOne,
  inheritable,
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
  type Kind,
  type Register,
  type TextValue,
  type TraitName,
  type Value,
} from "@airdesign/document"
import {
  exportParts,
  readCells,
  readNotes,
  readTable,
  shownEffects,
  shownBody,
  shownConnection,
  shownFill,
  shownGeometry,
  shownLine,
  shownTurn,
} from "@airdesign/pptx"
import { beforeAll, describe, expect, it } from "vitest"
import { optionCopy } from "./copy/option-copy"
import { panelOf, shownOnly } from "./design/panel"
import { traitControls } from "./design/trait-controls"
import { ensureMarkup } from "./markup"
import {
  agentRegister,
  deckParts,
  element,
  indexed,
  judgedCases,
  landed,
  painted,
  placed,
  sameParts,
  type At,
  type Parts,
  type Probe,
} from "./parity-probe"
import { pictureProbes } from "./picture-probes"
import { themeProbe } from "./theme-probe"

type Layer = "change" | "wire" | "control" | "round-trip" | "paint-change" | "undo" | "inherit" | "pptx-case"

type Problem = { readonly field: string; readonly missing: Layer } | { readonly word: string; readonly missing: "copy" }

const lineOpening = {
  fill: "opening",
  width: "opening",
  dash: "opening",
  cap: "opening",
  compound: "opening",
  join: "opening",
  head: "opening",
  tail: "opening",
} as const

const effectsOpening = { shadow: "opening", glow: "opening", softEdge: "opening" } as const
const bodyOpening = {
  insets: "opening",
  anchor: "opening",
  wrap: "opening",
  autofit: "opening",
  vertical: "opening",
  columns: "opening",
} as const

function bodyProbe(field: "insets" | "anchor" | "wrap" | "autofit" | "vertical" | "columns") {
  return {
    file: (parts: Parts, at: At) => shownBody(parts, at)?.[field].value,
    shows: (value: unknown) => value,
    inherited: (parts: Parts, at: At) => shownBody(parts, at)?.[field].own === false,
  }
}

const boxOpening = {
  x: "opening",
  y: "opening",
  w: "opening",
  h: "opening",
  rot: "opening",
  flipH: "opening",
  flipV: "opening",
} as const

function words(text: TextValue): string {
  return text.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")
}

const openingBorder = { width: 12700, fill: { solid: { scheme: "tx1" } } }

function grid(parts: Parts, at: At): readonly (readonly unknown[])[] | undefined {
  const cells = readCells(parts, at.part, at.shape)
  return readTable(parts, at.part, at.shape)?.rows.map((row, line) =>
    row.cells.map((cell, column) => {
      const read = cells[line]?.[column]
      return [words(cell), read?.fill ?? null, read?.borders.bottom ?? null]
    }),
  )
}

function gridShown(value: string): readonly (readonly unknown[])[] | undefined {
  return readTableValue(value)?.rows.map((row) =>
    row.cells.map((cell, column) => [
      words(cell),
      row.fills?.[column] ?? null,
      { ...openingBorder, ...row.borders?.[column]?.bottom },
    ]),
  )
}

const probes: { readonly [T in TraitName]: Probe<T> } = {
  identity: pictureProbes.identity,
  geometry: {
    deck: "clean.pptx",
    kind: "shape",
    opening: () => ({ v: format, patch: { geometry: { shape: "opening" } } }),
    edit: (_, __, value) => ({ v: format, patch: { geometry: { shape: { set: value } } } }),
    fields: { shape: { file: (parts, at) => shownGeometry(parts, at)?.value, shows: (value) => value } },
  },
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
  line: {
    deck: "census-updating-spm.pptx",
    kind: "connector",
    node: "324.26",
    opening: () => ({ v: format, patch: { line: lineOpening } }),
    edit: (_, field, value) => ({ v: format, patch: { line: { [field]: { set: value } } } }),
    fields: {
      fill: {
        file: (parts, at) => shownLine(parts, at)?.fill.value,
        shows: (value) => value,
        inherited: (parts, at) => shownLine(parts, at)?.fill.own === false,
      },
      width: {
        file: (parts, at) => shownLine(parts, at)?.width.value,
        shows: (value) => value,
        inherited: (parts, at) => shownLine(parts, at)?.width.own === false,
      },
      dash: {
        file: (parts, at) => shownLine(parts, at)?.dash.value,
        shows: (value) => value,
        inherited: (parts, at) => shownLine(parts, at)?.dash.own === false,
      },
      cap: {
        file: (parts, at) => shownLine(parts, at)?.cap.value,
        shows: (value) => value,
        inherited: (parts, at) => shownLine(parts, at)?.cap.own === false,
      },
      compound: {
        file: (parts, at) => shownLine(parts, at)?.compound.value,
        shows: (value) => value,
        inherited: (parts, at) => shownLine(parts, at)?.compound.own === false,
      },
      join: {
        file: (parts, at) => shownLine(parts, at)?.join.value,
        shows: (value) => value,
        inherited: (parts, at) => shownLine(parts, at)?.join.own === false,
      },
      head: {
        file: (parts, at) => shownLine(parts, at)?.head.value,
        shows: (value) => value,
        inherited: (parts, at) => shownLine(parts, at)?.head.own === false,
      },
      tail: {
        file: (parts, at) => shownLine(parts, at)?.tail.value,
        shows: (value) => value,
        inherited: (parts, at) => shownLine(parts, at)?.tail.own === false,
      },
    },
  },
  effects: {
    deck: "clean.pptx",
    kind: "shape",
    opening: () => ({ v: format, patch: { effects: effectsOpening } }),
    edit: (_, field, value) => ({ v: format, patch: { effects: { [field]: { set: value } } } }),
    fields: {
      shadow: { file: (parts, at) => shownEffects(parts, at)?.shadow.value, shows: (value) => value },
      glow: { file: (parts, at) => shownEffects(parts, at)?.glow.value, shows: (value) => value },
      softEdge: { file: (parts, at) => shownEffects(parts, at)?.softEdge.value, shows: (value) => value },
    },
  },
  body: {
    deck: "nasa-1d-cnn.pptx",
    kind: "shape",
    node: "467.5",
    opening: () => ({ v: format, patch: { body: bodyOpening } }),
    edit: (_, field, value) => ({ v: format, patch: { body: { [field]: { set: value } } } }),
    fields: {
      insets: bodyProbe("insets"),
      anchor: bodyProbe("anchor"),
      wrap: bodyProbe("wrap"),
      autofit: bodyProbe("autofit"),
      vertical: bodyProbe("vertical"),
      columns: bodyProbe("columns"),
    },
  },
  image: pictureProbes.image,
  crop: pictureProbes.crop,
  connection: {
    deck: "census-updating-spm.pptx",
    kind: "connector",
    node: "324.26",
    opening: () => ({ v: format, patch: { connection: { start: "opening", end: "opening" } } }),
    edit: (_, field, value) => ({ v: format, patch: { connection: { [field]: { set: value } } } }),
    fields: {
      start: { file: (parts, at) => shownConnection(parts, at)?.start, shows: (value) => value },
      end: { file: (parts, at) => shownConnection(parts, at)?.end, shows: (value) => value },
    },
  },
  box: {
    deck: "clean.pptx",
    kind: "shape",
    opening: () => ({ v: format, patch: { box: boxOpening } }),
    edit: (_, field, value) => ({ v: format, patch: { box: { [field]: { set: value } } } }),
    fields: {
      x: { file: (parts, at) => element(parts, at)?.box?.x, shows: (value) => value },
      y: { file: (parts, at) => element(parts, at)?.box?.y, shows: (value) => value },
      w: { file: (parts, at) => element(parts, at)?.box?.cx, shows: (value) => value },
      h: { file: (parts, at) => element(parts, at)?.box?.cy, shows: (value) => value },
      rot: { file: (parts, at) => shownTurn(parts, at).rot, shows: (value) => value },
      flipH: { file: (parts, at) => shownTurn(parts, at).flipH, shows: (value) => value },
      flipV: { file: (parts, at) => shownTurn(parts, at).flipV, shows: (value) => value },
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
      value: { file: grid, shows: gridShown },
    },
  },
  theme: themeProbe,
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

function panelRow(register: Register, at: At, trait: TraitName, field: string) {
  const view = registerScope(register).view(at.node)
  const sections = view === undefined ? undefined : panelOf(view, { reads: {}, moves: true }).sections
  return sections?.find((section) => section.trait === trait)?.rows.find((each) => each.field === field)
}

function panelRegister(register: Register, at: At, trait: TraitName, field: string, value: unknown): Register | null {
  const scope = registerScope(register)
  const control = panelRow(register, at, trait, field)
  const planned = control === undefined ? null : planChange(control.change(value), scope)
  if (planned === null || !planned.ok) return null
  const holder = valueHolder(register, at.node, "person")
  const commands = planned.rows.flatMap(({ node, row: planned }): Command[] =>
    (formatOne(planned.patch, holder) ?? [planned]).map((each) => ({ command: "person", node, ...each })),
  )
  const opened = landed(register, [{ command: "add", node: at.node, floor: "", route: "clean" }])
  return commands.length === 0 || opened === null ? null : landed(opened, commands)
}

function same(left: unknown, right: unknown): boolean {
  return left !== undefined && JSON.stringify(left) === JSON.stringify(right)
}

type Loose = {
  readonly deck: string
  readonly kind: Kind
  readonly node?: string
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
  readonly painted?: (parts: Parts, at: At, field: string) => string
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
  const at = placed(parts, probe.kind, probe.node)
  const shape = probe.fields[field]
  const opening = probe.opening(parts, at)
  const edit = probe.edit(opening, field, value)
  const shown = (exported: Parts) => shape !== undefined && same(shape.file(exported, at), shape.shows(value))
  const problems: Problem[] = shown(parts) ? [{ field: key, missing: "change" }] : []
  const agent = agentRegister(indexed(parts), at, sent)
  if (agent === null || !shown(exportParts(parts, agent))) problems.push({ field: key, missing: "wire" })
  if (shownOnly.includes(key)) {
    if (panelRow(indexed(parts), at, trait, field)?.shownOnly !== true)
      problems.push({ field: key, missing: "control" })
  } else {
    const panel = panelRegister(indexed(parts), at, trait, field, value)
    if (panel === null || !shown(exportParts(parts, panel))) problems.push({ field: key, missing: "control" })
  }
  const person = landed(indexed(parts), [
    { command: "add", node: at.node, floor: "", route: "clean" },
    { command: "person", node: at.node, ...edit },
  ])
  const exported = person === null ? parts : exportParts(parts, person)
  if (person === null || !shown(exported)) problems.push({ field: key, missing: "round-trip" })
  const paint = probe.painted ?? painted
  if (probe.kind !== "slide" && paint(exported, at, field) === paint(parts, at, field)) {
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
  if (!judgedCases.some((each) => each.covers?.includes(key))) problems.push({ field: key, missing: "pptx-case" })
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
  const at = placed(parts, probe.kind, probe.node)
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
    ...Object.entries(traits[trait].fields as Readonly<Record<string, { readonly desc: Desc }>>).filter(
      ([field]) => !alphaField(trait, field),
    ),
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

function alphaField(trait: TraitName, field: string): boolean {
  return (traits[trait].fields as Readonly<Record<string, { readonly desc: Desc }>>)[field]?.desc.kind === "alpha"
}

async function parityProblems(): Promise<readonly Problem[]> {
  const problems: Problem[] = []
  for (const trait of traitNames) {
    if (Object.keys(traits[trait].fields).length === 0) continue
    const probe = probes[trait] as Loose
    const wire = traitWire[trait] as Partial<LooseWire>
    problems.push(...copyProblems(trait, traitControls[trait] as Partial<LooseControls>, wire))
    for (const field of Object.keys(traits[trait].fields))
      if (!alphaField(trait, field)) problems.push(...(await fieldProblems(trait, field, probe, wire)))
    for (const input of Object.keys(traits[trait].inputs))
      problems.push(...(await inputProblems(trait, input, probe, wire)))
  }
  return problems
}

let found: readonly Problem[] = []

beforeAll(async () => {
  await ensureMarkup()
  found = await parityProblems()
}, 120_000)

describe("every live trait field reaches every layer", () => {
  it("lands each field's example as an agent and as a person, exports it, reads it, paints it, undoes it and judges it", () => {
    expect(found).toEqual([])
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
