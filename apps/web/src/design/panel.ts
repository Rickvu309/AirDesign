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
  type ScopedElement,
  type SetChange,
  type TextValue,
  type TraitName,
  type TraitReads,
} from "@airdesign/document"
import type { ReactNode } from "react"
import { optionWord } from "@/copy/option-copy"
import type { Palette } from "./color-choices"
import { cropChange } from "./crop-change"
import { opacitySection } from "./opacity-row"
import { hidden, panelKind, panelOrder, type PanelKind } from "./panel-order"
import { alphaFieldOver, atShownAlpha } from "./shown-alpha"
import { traitControls } from "./trait-controls"

export const controlKinds = [
  "length",
  "angle",
  "percent",
  "count",
  "toggle",
  "choice",
  "action",
  "color",
  "hex",
  "record",
  "union",
  "list",
  "adjust",
  "text",
  "table",
  "asset",
  "node",
  "site",
  "preset",
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
    case "hex":
      return "hex"
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

export type SectionName = TraitName | "opacity"

export type PanelRow = {
  readonly trait: SectionName
  readonly field: string
  readonly label: string
  readonly control: ControlKind
  readonly desc: Desc
  readonly value: unknown
  readonly mixed: boolean
  readonly inherited: boolean
  readonly caption: boolean
  readonly reset: string | null
  readonly parent?: unknown
  readonly nodes?: readonly NodeChoice[]
  readonly change: (value: unknown) => SetChange
}

export type NodeChoice = {
  readonly node: ElementId
  readonly name: string
  readonly sites: readonly string[]
}

export type ControlProps = {
  readonly row: PanelRow
  readonly palette: Palette
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
    control:
      row.trait === "connection" && name === "site"
        ? "site"
        : row.trait === "geometry" && name === "preset"
          ? "preset"
          : controlOf(desc),
    desc,
    value,
    caption: true,
    reset: null,
  }
}

export type PanelSection = {
  readonly trait: SectionName
  readonly label: string
  readonly open: boolean
  readonly rows: readonly PanelRow[]
}

export type PanelModel = {
  readonly node: ElementId
  readonly kind: PanelKind | null
  readonly sections: readonly PanelSection[]
}

type Loose = Readonly<Record<string, { readonly desc: Desc }>>

type Labels = {
  readonly section?: string
  readonly fields: Readonly<Record<string, { readonly label: string; readonly reset?: string }>>
}

const paragraphKeys = ["align", "bullet", "lineSpacing", "spaceBefore", "spaceAfter"] as const

type Held = { readonly value: unknown; readonly mixed: boolean; readonly inherited: boolean }

const ownHeld = (value: unknown): Held => ({ value, mixed: false, inherited: false })

function fallbackOf(reads: TraitReads, key: string, read: ShownField | undefined): Held {
  if (read !== undefined)
    return { value: read.value ?? undefined, mixed: false, inherited: !read.own && read.value !== null }
  const named = key === "size" || key === "color" || key === "font" || key === "bold" ? reads[`text.${key}`] : undefined
  if (named !== undefined) return { value: named.value, mixed: false, inherited: named.source !== undefined }
  if (key === "color") return { value: { scheme: "tx1" }, mixed: false, inherited: true }
  const off = key === "bold" || key === "italic" || key === "underline" || key === "bullet"
  return ownHeld(off ? false : undefined)
}

function agreed(values: readonly unknown[], fallback: Held): Held {
  const [first, ...rest] = values.map((value) => value ?? fallback.value)
  const mixed = rest.some((each) => JSON.stringify(each) !== JSON.stringify(first))
  const inherited = fallback.inherited && values.every((value) => value === undefined)
  return { value: mixed ? undefined : first, mixed, inherited: inherited && !mixed }
}

function textShown(text: TextValue, key: string, fallback: Held): Held {
  if ((paragraphKeys as readonly string[]).includes(key)) {
    return agreed(
      text.map((paragraph) => (paragraph as Readonly<Record<string, unknown>>)[key]),
      fallback,
    )
  }
  const runs = text.flatMap((paragraph) => paragraph.runs).filter((run) => run.text !== "")
  if (runs.length === 0) return fallback
  return agreed(
    runs.map((run) => (run as Readonly<Record<string, unknown>>)[key]),
    fallback,
  )
}

export type ShownField = { readonly value: unknown; readonly own: boolean }

function shownOf(view: ScopedElement, trait: TraitName, field: string, shown: PanelReads): Held {
  const read = shown.fields?.[`${trait}.${field}`]
  const reads = shown.reads
  if (trait === "text" && field !== "value") {
    const text = readTextValue(view.value ?? "") ?? []
    return textShown(text, field, fallbackOf(reads, field, read))
  }
  if (read !== undefined)
    return { value: read.value ?? undefined, mixed: false, inherited: !read.own && read.value !== null }
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
    return ownHeld(sides[field])
  }
  if (trait === "geometry" || trait === "theme" || trait === "connection") return ownHeld(undefined)
  return ownHeld(field === "value" ? (view.value ?? "") : undefined)
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
  readonly nodes?: readonly NodeChoice[]
}

function shownDesc(desc: Desc, grouped: boolean, value: unknown): Desc {
  if (desc.kind !== "union" || grouped || (typeof value === "object" && value !== null && "group" in value)) return desc
  return { ...desc, cases: Object.fromEntries(Object.entries(desc.cases).filter(([name]) => name !== "group")) }
}

function lineless(trait: TraitName, rows: readonly PanelRow[]): boolean {
  const fill = rows.find((row) => row.field === "fill")?.value
  return trait === "line" && typeof fill === "object" && fill !== null && "none" in fill
}

const actions = ["box.align", "box.distribute"]

function joined(shown: PanelReads): boolean {
  return (["connection.start", "connection.end"] as const).some((key) => {
    const value = shown.fields?.[key]?.value
    return typeof value === "object" && value !== null && "shape" in value
  })
}

export function panelOf(view: ScopedElement, shown: PanelReads): PanelModel {
  const routed = view.facts.kind === "connector" && joined(shown)
  const taken = takes(view.facts).filter(
    (field) =>
      (shown.moves || !field.startsWith("box.")) && !(routed && (field === "box.flipH" || field === "box.flipV")),
  )
  const sections = traitNames.flatMap((trait): PanelSection[] => {
    const labels = traitControls[trait] as Labels
    const rows = wireFields(trait).flatMap(([field, kind]): PanelRow[] => {
      const key = writtenField(trait, field)
      if (!taken.includes(key) || keptRefuses(view.kept, trait, field)) return []
      const copy = labels.fields[field]
      const own = shown.fields?.[key]?.own === true
      const reset = own && inheritable(trait, field) ? (copy?.reset ?? null) : null
      const held = shownOf(view, trait, field, shown)
      const over = held.inherited ? alphaFieldOver(trait, field) : undefined
      const seen = over === undefined ? undefined : shown.fields?.[`${trait}.${over}`]?.value
      const change =
        key === "crop.rect" && taken.includes("box.w")
          ? cropChange(view, held.value)
          : (value: unknown) =>
              ({
                target: { node: view.node },
                [trait]: { [field]: typeof seen === "number" ? atShownAlpha(value, seen) : value },
              }) as SetChange
      const desc = shownDesc(kind, view.facts.grouped, held.value)
      const label = copy?.label ?? ""
      const caption = label !== labels.section
      const nodes = trait === "connection" && shown.nodes !== undefined ? { nodes: shown.nodes } : {}
      return [
        {
          trait,
          field,
          label,
          control: actions.includes(`${trait}.${field}`) ? "action" : controlOf(desc),
          desc,
          ...held,
          caption,
          reset,
          ...nodes,
          change,
        },
      ]
    })
    const visible = lineless(trait, rows) ? rows.filter((row) => row.field === "fill") : rows
    return visible.length === 0 ? [] : [{ trait, label: labels.section ?? "", open: true, rows: visible }]
  })
  const opacity = opacitySection(view, shown)
  const kind = panelKind(view, shown)
  return {
    node: view.node,
    kind,
    sections: ordered(kind, [...sections, ...(opacity === null ? [] : [opacity])], shown),
  }
}

function ordered(
  kind: PanelKind | null,
  sections: readonly PanelSection[],
  shown: PanelReads,
): readonly PanelSection[] {
  if (kind === null) return sections
  const places = panelOrder[kind]
  const left = hidden(kind, shown)
  return places.flatMap((place) => {
    const section = sections.find(({ trait }) => trait === place.section)
    return section === undefined || left.includes(place.section) ? [] : [{ ...section, open: place.open }]
  })
}
