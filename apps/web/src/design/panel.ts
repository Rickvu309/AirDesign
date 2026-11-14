import {
  inheritable,
  keptRefuses,
  readTextValue,
  takes,
  traitNames,
  traits,
  writtenField,
  type Desc,
  type ElementId,
  type SchemeName,
  type ScopedElement,
  type SetChange,
  type TextValue,
  type TraitName,
  type TraitReads,
} from "@airdesign/document"
import type { ReactNode } from "react"
import { optionWord } from "@/copy/option-copy"
import { traitControls } from "./trait-controls"

export const controlKinds = [
  "length",
  "angle",
  "percent",
  "count",
  "toggle",
  "choice",
  "color",
  "record",
  "union",
  "list",
  "adjust",
  "text",
  "table",
  "asset",
  "node",
] as const

export type ControlKind = (typeof controlKinds)[number]

export function controlOf(desc: Desc): ControlKind {
  switch (desc.kind) {
    case "number":
      if (desc.unit === "emu" || desc.unit === "hundredth-point") return "length"
      return desc.unit === "angle" ? "angle" : desc.unit === "fraction" ? "percent" : "count"
    case "flag":
    case "mark":
      return "toggle"
    case "words":
    case "text":
      return "text"
    case "choice":
      return "choice"
    case "color":
      return "color"
    case "alpha":
      return "percent"
    case "record":
      return "record"
    case "union":
      return "union"
    case "list":
      return "list"
    case "named":
      return "adjust"
    case "table":
      return "table"
    case "asset":
      return "asset"
    case "node":
      return "node"
  }
}

export type PanelRow = {
  readonly trait: TraitName
  readonly field: string
  readonly label: string
  readonly control: ControlKind
  readonly desc: Desc
  readonly value: unknown
  readonly mixed: boolean
  readonly caption: boolean
  readonly action?: boolean
  readonly reset: string | null
  readonly parent?: unknown
  readonly change: (value: unknown) => SetChange
}

export type Swatch = { readonly scheme: SchemeName; readonly css: string; readonly name: string }

export type ControlProps = {
  readonly row: PanelRow
  readonly palette: readonly Swatch[]
  readonly onChange: (value: unknown) => void
  readonly inner?: (props: ControlProps) => ReactNode
}

export function partRow(row: PanelRow, name: string, desc: Desc, value: unknown): PanelRow {
  const label = optionWord(row.field, name)
  return {
    ...row,
    parent: row.value,
    field: `${row.field}.${name}`,
    label,
    control: controlOf(desc),
    desc,
    value,
    caption: true,
    reset: null,
  }
}

export type PanelSection = { readonly trait: TraitName; readonly label: string; readonly rows: readonly PanelRow[] }

export type PanelModel = { readonly node: ElementId; readonly sections: readonly PanelSection[] }

type Loose = Readonly<Record<string, { readonly desc: Desc }>>

type Labels = {
  readonly section?: string
  readonly fields: Readonly<Record<string, { readonly label: string; readonly reset?: string }>>
}

const paragraphKeys = ["align", "bullet"] as const

function inherited(reads: TraitReads, key: string): unknown {
  if (key === "size") return reads["text.size"]?.value
  if (key === "color") return reads["text.color"]?.value
  if (key === "bold") return reads["text.bold"]?.value ?? false
  return key === "italic" || key === "underline" || key === "bullet" ? false : undefined
}

function agreed(values: readonly unknown[]): { readonly value: unknown; readonly mixed: boolean } {
  const [first, ...rest] = values
  const mixed = rest.some((each) => JSON.stringify(each) !== JSON.stringify(first))
  return { value: mixed ? undefined : first, mixed }
}

function textShown(text: TextValue, key: string, reads: TraitReads) {
  const fallback = inherited(reads, key)
  if ((paragraphKeys as readonly string[]).includes(key)) {
    return agreed(text.map((paragraph) => (paragraph as Readonly<Record<string, unknown>>)[key] ?? fallback))
  }
  const runs = text.flatMap((paragraph) => paragraph.runs).filter((run) => run.text !== "")
  if (runs.length === 0) return { value: fallback, mixed: false }
  return agreed(runs.map((run) => (run as Readonly<Record<string, unknown>>)[key] ?? fallback))
}

export type ShownField = { readonly value: unknown; readonly own: boolean }

function shownOf(view: ScopedElement, trait: TraitName, field: string, shown: PanelReads) {
  const read = shown.fields?.[`${trait}.${field}`]
  if (read !== undefined) return { value: read.value ?? undefined, mixed: false }
  const reads = shown.reads
  if (trait === "box") {
    const box = view.box
    const sides: Readonly<Record<string, unknown>> = {
      x: box?.x,
      y: box?.y,
      w: box?.cx,
      h: box?.cy,
      rot: reads["box.rot"]?.value ?? 0,
      flipH: reads["box.flipH"]?.value ?? false,
      flipV: reads["box.flipV"]?.value ?? false,
    }
    return { value: sides[field], mixed: false }
  }
  if (trait === "geometry") return { value: undefined, mixed: false }
  if (field === "value") return { value: view.value ?? "", mixed: false }
  const text = readTextValue(view.value ?? "") ?? []
  return textShown(text, field, reads)
}

function wireFields(trait: TraitName): readonly (readonly [string, Desc])[] {
  const fields = Object.entries(traits[trait].fields as Loose).filter(([, kind]) => kind.desc.kind !== "alpha")
  const inputs = Object.entries(traits[trait].inputs as Loose)
  return [...fields, ...inputs].map(([field, kind]) => [field, kind.desc] as const)
}

export type PanelReads = {
  readonly reads: TraitReads
  readonly moves: boolean
  readonly fields?: Readonly<Record<string, ShownField | undefined>>
}

function shownDesc(desc: Desc, grouped: boolean, value: unknown): Desc {
  if (desc.kind !== "union" || grouped || (typeof value === "object" && value !== null && "group" in value)) return desc
  return { ...desc, cases: Object.fromEntries(Object.entries(desc.cases).filter(([name]) => name !== "group")) }
}

function lineless(trait: TraitName, rows: readonly PanelRow[]): boolean {
  const fill = rows.find((row) => row.field === "fill")?.value
  return trait === "line" && typeof fill === "object" && fill !== null && "none" in fill
}

export function panelOf(view: ScopedElement, shown: PanelReads): PanelModel {
  const taken = takes(view.facts).filter((field) => shown.moves || !field.startsWith("box."))
  const sections = traitNames.flatMap((trait): PanelSection[] => {
    const labels = traitControls[trait] as Labels
    const rows = wireFields(trait).flatMap(([field, kind]): PanelRow[] => {
      const key = writtenField(trait, field)
      if (!taken.includes(key) || keptRefuses(view.kept, trait, field)) return []
      const copy = labels.fields[field]
      const own = shown.fields?.[key]?.own === true
      const reset = own && inheritable(trait, field) ? (copy?.reset ?? null) : null
      const change = (value: unknown) => ({ target: { node: view.node }, [trait]: { [field]: value } }) as SetChange
      const held = shownOf(view, trait, field, shown)
      const desc = shownDesc(kind, view.facts.grouped, held.value)
      const label = copy?.label ?? ""
      const caption = label !== labels.section
      const action = Object.hasOwn(traits[trait].inputs, field) && held.value === undefined ? { action: true } : {}
      return [{ trait, field, label, control: controlOf(desc), desc, ...held, caption, reset, ...action, change }]
    })
    const visible = lineless(trait, rows) ? rows.filter((row) => row.field === "fill") : rows
    return visible.length === 0 ? [] : [{ trait, label: labels.section ?? "", rows: visible }]
  })
  return { node: view.node, sections }
}
