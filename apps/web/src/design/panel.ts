import { authorableTrait } from "@airdesign/catalog"
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
import { appearanceSections } from "./appearance-presets"
import { cornersSection } from "./corners-control"
import { opacitySection } from "./opacity-control"
import { hidden, loneRows, panelKind, panelOrder, type PanelKind } from "./panel-order"
import { alphaFieldOver, atShownAlpha } from "./shown-alpha"
import { traitControls } from "./trait-controls"
import { arrange, canvasControl, resolveControl, type ControlKind, type ControlLook } from "./panel-arrangement"
export type { ControlKind } from "./panel-arrangement"

export type SectionName = TraitName | "opacity" | "alignment" | "border" | "shadow" | "pictureFill" | "corners"

export type PanelControl = {
  readonly trait: SectionName
  readonly field: string
  readonly label: string
  readonly kind: ControlKind
  readonly look: ControlLook
  readonly desc: Desc
  readonly value: unknown
  readonly mixed: boolean
  readonly inherited: boolean
  readonly reset: string | null
  readonly parent?: unknown
  readonly slides?: readonly string[]
  readonly nodes?: readonly NodeChoice[]
  readonly change: (value: unknown) => SetChange
}

export type NodeChoice = {
  readonly node: ElementId
  readonly name: string
  readonly sites: readonly string[]
}

export type ControlProps = {
  readonly control: PanelControl
  readonly palette: Palette
  readonly onChange: (value: unknown) => void
  readonly inner?: (props: ControlProps) => ReactNode
}

export function partControl(control: PanelControl, name: string, desc: Desc, value: unknown): PanelControl {
  const label = optionWord(control.field, name)
  return resolveControl({
    ...control,
    parent: control.value,
    field: `${control.field}.${name}`,
    label,
    desc,
    value,
    reset: null,
  })
}

export type PanelSection = {
  readonly trait: SectionName
  readonly label: string | null
  readonly open: boolean
  readonly strips: readonly (readonly PanelControl[])[]
}

export type PanelModel = {
  readonly node: ElementId
  readonly nodes: readonly ElementId[]
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
  readonly slides?: readonly string[]
  readonly nodes?: readonly NodeChoice[]
}

function shownDesc(desc: Desc, grouped: boolean, value: unknown): Desc {
  if (desc.kind !== "union" || grouped || (typeof value === "object" && value !== null && "group" in value)) return desc
  return { ...desc, cases: Object.fromEntries(Object.entries(desc.cases).filter(([name]) => name !== "group")) }
}

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
  const sections = traitNames.filter(authorableTrait).flatMap((trait): PanelSection[] => {
    const labels = traitControls[trait] as Labels
    const controls = wireFields(trait).flatMap(([field, kind]): PanelControl[] => {
      const key = writtenField(trait, field)
      if (canvasControl(trait, field) || !taken.includes(key) || keptRefuses(view.kept, trait, field)) return []
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
      const nodes = trait === "connection" && shown.nodes !== undefined ? { nodes: shown.nodes } : {}
      return [
        resolveControl({
          trait,
          field,
          label,
          desc,
          ...(shown.slides === undefined ? {} : { slides: shown.slides }),
          ...held,
          reset,
          ...nodes,
          change,
        }),
      ]
    })
    const visible = controls
    return visible.length === 0
      ? []
      : [{ trait, label: labels.section ?? "", open: true, strips: arrange(trait, visible) }]
  })
  const alignment = sections.flatMap((section) =>
    section.trait === "box"
      ? section.strips.flat().filter((control) => control.field === "align" || control.field === "distribute")
      : [],
  )
  const content = sections.flatMap((section) => {
    const strips = section.strips
      .map((strip) => strip.filter((control) => !alignment.includes(control)))
      .filter((strip) => strip.length > 0)
    return strips.length === 0 ? [] : [{ ...section, strips }]
  })
  const alignSection: PanelSection[] =
    alignment.length === 0 ? [] : [{ trait: "alignment", label: null, open: true, strips: [alignment] }]
  const opacity = opacitySection(view, shown)
  const corners = cornersSection(view, shown)
  const kind = panelKind(view, shown)
  return {
    node: view.node,
    nodes: [view.node],
    kind,
    sections: ordered(
      kind,
      appearanceSections(
        [...alignSection, ...content, ...(opacity === null ? [] : [opacity]), ...(corners === null ? [] : [corners])],
        kind,
      ),
      shown,
    ),
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

function present<T>(items: readonly (T | undefined)[]): readonly T[] | null {
  const found = items.filter((item) => item !== undefined)
  return found.length === items.length ? found : null
}

function sameValue(controls: readonly PanelControl[]): boolean {
  const [first, ...rest] = controls.map((control) => JSON.stringify(control.value))
  return controls.every((control) => !control.mixed) && rest.every((each) => each === first)
}

function caseOf(value: unknown): string | undefined {
  return typeof value === "object" && value !== null ? Object.keys(value)[0] : undefined
}

function manyControl(controls: readonly PanelControl[], lead: PanelControl, nodes: readonly ElementId[]): PanelControl {
  const mixed = !sameValue(controls)
  const shared = lead.desc.kind === "union" && controls.every((control) => caseOf(control.value) === caseOf(lead.value))
  return {
    ...lead,
    value: mixed && !shared ? undefined : lead.value,
    mixed,
    inherited: !mixed && controls.every((control) => control.inherited),
    reset: null,
    change: (value) => ({ ...lead.change(value), target: { nodes } }),
  }
}

export function panelOfMany(models: readonly [PanelModel, ...PanelModel[]]): PanelModel {
  const nodes = models.flatMap((model) => model.nodes)
  const sections = panelOrder.many.flatMap((place): PanelSection[] => {
    const found = present(models.map((model) => model.sections.find(({ trait }) => trait === place.section)))
    const [lead] = found ?? []
    if (found === null || lead === undefined) return []
    const controls = lead.strips.flat().flatMap((control): PanelControl[] => {
      if (loneRows.includes(`${control.trait}.${control.field}`)) return []
      const each = present(found.map((section) => section.strips.flat().find(({ field }) => field === control.field)))
      return each === null ? [] : [manyControl(each, control, nodes)]
    })
    return controls.length === 0 ? [] : [{ ...lead, open: place.open, strips: arrange(lead.trait, controls) }]
  })
  const [first, ...rest] = models
  return { node: (rest.at(-1) ?? first).node, nodes, kind: "many", sections }
}
