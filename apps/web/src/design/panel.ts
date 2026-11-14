import {
  readTextValue,
  takes,
  traitNames,
  traits,
  type Desc,
  type ElementId,
  type FieldKey,
  type SchemeName,
  type ScopedElement,
  type SetChange,
  type TextValue,
  type TraitName,
  type TraitReads,
} from "@airdesign/document"
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
  readonly change: (value: unknown) => SetChange
}

export type Swatch = { readonly scheme: SchemeName; readonly css: string; readonly name: string }

export type ControlProps = {
  readonly row: PanelRow
  readonly palette: readonly Swatch[]
  readonly onChange: (value: unknown) => void
}

export type PanelSection = { readonly trait: TraitName; readonly label: string; readonly rows: readonly PanelRow[] }

export type PanelModel = { readonly node: ElementId; readonly sections: readonly PanelSection[] }

type Loose = Readonly<Record<string, { readonly desc: Desc }>>

type Labels = { readonly section?: string; readonly fields: Readonly<Record<string, { readonly label: string }>> }

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

function shownOf(view: ScopedElement, trait: TraitName, field: string, reads: TraitReads) {
  if (trait === "box") {
    const box = view.box
    const sides: Readonly<Record<string, number | undefined>> = { x: box?.x, y: box?.y, w: box?.cx, h: box?.cy }
    return { value: sides[field], mixed: false }
  }
  if (field === "value") return { value: view.value ?? "", mixed: false }
  const text = readTextValue(view.value ?? "") ?? []
  return textShown(text, field, reads)
}

function written(trait: TraitName, field: string): FieldKey {
  return `${trait}.${Object.hasOwn(traits[trait].inputs, field) ? "value" : field}` as FieldKey
}

function wireFields(trait: TraitName): readonly (readonly [string, Desc])[] {
  const fields = Object.entries(traits[trait].fields as Loose).filter(([, kind]) => kind.desc.kind !== "alpha")
  const inputs = Object.entries(traits[trait].inputs as Loose)
  return [...fields, ...inputs].map(([field, kind]) => [field, kind.desc] as const)
}

export type PanelReads = { readonly reads: TraitReads; readonly moves: boolean }

export function panelOf(view: ScopedElement, shown: PanelReads): PanelModel {
  const taken = takes(view.facts).filter((field) => shown.moves || !field.startsWith("box."))
  const kept = view.kept as readonly string[]
  const sections = traitNames.flatMap((trait): PanelSection[] => {
    const labels = traitControls[trait] as Labels
    const rows = wireFields(trait).flatMap(([field, desc]): PanelRow[] => {
      const key = written(trait, field)
      if (!taken.includes(key) || kept.includes(trait) || kept.includes(`${trait}.${field}`)) return []
      const label = labels.fields[field]?.label ?? ""
      const change = (value: unknown) => ({ target: { node: view.node }, [trait]: { [field]: value } }) as SetChange
      return [
        { trait, field, label, control: controlOf(desc), desc, ...shownOf(view, trait, field, shown.reads), change },
      ]
    })
    return rows.length === 0 ? [] : [{ trait, label: labels.section ?? "", rows }]
  })
  return { node: view.node, sections }
}
