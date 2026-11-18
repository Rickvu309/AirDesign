import { authorableTrait, readAgent, traitWire } from "@airdesign/catalog"
import {
  inheritable,
  rowOf,
  slotted,
  traitNames,
  traits,
  undoOf,
  type Desc,
  type Kind,
  type TraitName,
  type Value,
} from "@airdesign/document"
import { exportParts } from "@airdesign/pptx"
import { beforeAll, describe, expect, it } from "vitest"
import { optionCopy } from "./copy/option-copy"
import { canvasControl } from "./design/panel-arrangement"
import { traitControls } from "./design/trait-controls"
import { ensureMarkup } from "./markup"
import {
  agentRegister,
  deckParts,
  indexed,
  judgedCases,
  landed,
  painted,
  panelRegister,
  placed,
  sameParts,
  type At,
  type Parts,
} from "./parity-probe"
import { probes } from "./trait-probes"

type Layer = "change" | "wire" | "control" | "round-trip" | "paint-change" | "undo" | "inherit" | "pptx-case"

type Problem = { readonly field: string; readonly missing: Layer } | { readonly word: string; readonly missing: "copy" }

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
  const desc = kindsOf(trait)[field]?.desc
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
  const person = landed(indexed(parts), [
    { command: "add", node: at.node, floor: "", route: "clean" },
    { command: "person", node: at.node, ...edit },
  ])
  const panel = canvasControl(trait, field) ? person : panelRegister(indexed(parts), at, trait, field, value)
  if (panel === null || !shown(exportParts(parts, panel))) problems.push({ field: key, missing: "control" })
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
  const parts = await deckParts(key === "text.style" ? "doe-heat-pumps.pptx" : probe.deck)
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

function kindsOf(trait: TraitName): Readonly<Record<string, { readonly desc: Desc }>> {
  return { ...traits[trait].fields, ...traits[trait].inputs }
}

function copyProblems(trait: TraitName, controls: Partial<LooseControls>, wire: Partial<LooseWire>): Problem[] {
  const fields = [
    ...Object.entries(traits[trait].fields as Readonly<Record<string, { readonly desc: Desc }>>).filter(
      ([field]) => !alphaField(trait, field) && !slotted(trait, field),
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
  for (const trait of traitNames.filter(authorableTrait)) {
    if (Object.keys(traits[trait].fields).length === 0) continue
    const probe = probes[trait] as Loose
    const wire = traitWire[trait] as Partial<LooseWire>
    problems.push(...copyProblems(trait, traitControls[trait] as Partial<LooseControls>, wire))
    for (const field of Object.keys(traits[trait].fields))
      if (!alphaField(trait, field) && !slotted(trait, field))
        problems.push(...(await fieldProblems(trait, field, probe, wire)))
    const slots = traits[trait].slots.length > 0
    for (const input of Object.keys(traits[trait].inputs))
      problems.push(
        ...(await (slots ? fieldProblems(trait, input, probe, wire) : inputProblems(trait, input, probe, wire))),
      )
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
