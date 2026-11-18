import { typographyControls } from "./typography-controls"
import { formatCopy } from "@/copy/format-copy"
import { authorableTrait } from "@airdesign/catalog"
import {
  inheritable,
  keptRefuses,
  readTextValue,
  slotted,
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
import type { CSSProperties, ReactNode } from "react"
import { fillCopy } from "@/copy/fill-copy"
import { pictureCopy } from "@/copy/picture-copy"
import { textCopy } from "@/copy/text-copy"
import { optionWord } from "@/copy/option-copy"
import type { Palette } from "./color-choices"
import { cropChange } from "./crop-change"
import { fillsList } from "./fills-list"
import { fillsHeld, overlayChange, overlayHeld, ownHeld, shownFills, type Held } from "./fills-held"
import { appearanceSections } from "./appearance-presets"
import { endsOpen } from "./border-ends"
import { listEffects } from "./effects-list"
import { cornersSection } from "./corners-control"
import { opacitySection } from "./opacity-control"
import {
  hidden,
  loneRows,
  panelKind,
  panelOrder,
  panelPlaces,
  sectionInMode,
  type PanelKind,
  type PanelMode,
} from "./panel-order"
import { alphaFieldOver, atShownAlpha } from "./shown-alpha"
import { traitControls } from "./trait-controls"
import { arrange, canvasControl, resolveControl, type ControlKind, type ControlLook } from "./panel-arrangement"
export type { ControlKind } from "./panel-arrangement"

export type SectionName =
  | TraitName
  | "opacity"
  | "alignment"
  | "shadow"
  | "pictureFill"
  | "textFill"
  | "boxFill"
  | "corners"
  | "paragraphSpacing"
  | "fillDetails"
  | "image"
  | "crop"

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
  readonly choices?: readonly {
    readonly value: string
    readonly label: string
    readonly font?: string | undefined
    readonly detail?: string | undefined
    readonly appearance?: CSSProperties
  }[]
  readonly placeholder?: string
  readonly numberScale?: number
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
  const textFill = control.trait === "textFill" || (control.trait === "text" && control.field === "fill")
  const label = textFill && name === "solid" ? formatCopy.color : optionWord(control.field, name)
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
  readonly designStrips?: readonly (readonly PanelControl[])[]
}

export type PanelModel = {
  readonly node: ElementId
  readonly nodes: readonly ElementId[]
  readonly kind: PanelKind | null
  readonly selectionKinds?: readonly (PanelKind | null)[]
  readonly sections: readonly PanelSection[]
}

type Loose = Readonly<Record<string, { readonly desc: Desc }>>

type Labels = {
  readonly section?: string
  readonly fields: Readonly<Record<string, { readonly label: string; readonly reset?: string }>>
}

const paragraphKeys = ["align", "list", "lineHeight", "spaceBefore", "spaceAfter"] as const

function fallbackOf(reads: TraitReads, key: string, read: ShownField | undefined): Held {
  if (read !== undefined)
    return { value: read.value ?? undefined, mixed: false, inherited: !read.own && read.value !== null }
  const named = key === "size" || key === "color" || key === "font" || key === "bold" ? reads[`text.${key}`] : undefined
  if (named !== undefined) return { value: named.value, mixed: false, inherited: named.source !== undefined }
  if (key === "fill")
    return { value: { solid: reads["text.color"]?.value ?? { scheme: "tx1" } }, mixed: false, inherited: true }
  if (key === "color") return { value: { scheme: "tx1" }, mixed: false, inherited: true }
  if (key === "list") return ownHeld("none")
  if (key === "letterSpacing") return ownHeld(0)
  const off = key === "bold" || key === "italic" || key === "underline" || key === "strike"
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
    runs.map((run) =>
      key === "fill"
        ? (run.fill ?? (run.color === undefined ? undefined : { solid: run.color }))
        : (run as Readonly<Record<string, unknown>>)[key],
    ),
    fallback,
  )
}

export type ShownField = { readonly value: unknown; readonly own: boolean }

const imageFields: readonly string[] = ["mode", "source", "recolor", "overlay", "blur"]

export function shownPlace(trait: TraitName, field: string): { readonly trait: SectionName; readonly field: string } {
  if (trait !== "fills") return { trait, field }
  if (field === "crop") return { trait: "crop", field: "rect" }
  return imageFields.includes(field) ? { trait: "image", field } : { trait, field }
}

function sectionLabel(trait: SectionName, labels: Labels): string {
  if (trait === "image") return pictureCopy.section
  return trait === "crop" ? pictureCopy.crop : (labels.section ?? "")
}

function shownOf(view: ScopedElement, trait: TraitName, field: string, shown: PanelReads): Held {
  if (trait === "fills" && field === "paint") return fillsHeld(shown)
  if (trait === "fills" && field === "overlay") return overlayHeld(shown)
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
  if (trait === "geometry" || trait === "templateStyle" || trait === "connection") return ownHeld(undefined)
  return ownHeld(field === "value" ? (view.value ?? "") : undefined)
}

function wireFields(trait: TraitName): readonly (readonly [string, Desc])[] {
  const fields = Object.entries(traits[trait].fields as Loose).filter(
    ([field, kind]) => kind.desc.kind !== "alpha" && !slotted(trait, field),
  )
  const inputs = Object.entries(traits[trait].inputs as Loose)
  return [...fields, ...inputs].map(([field, kind]) => [field, kind.desc] as const)
}

export type PanelReads = {
  readonly fonts?: { readonly major?: string; readonly minor?: string }
  readonly reads: TraitReads
  readonly moves: boolean
  readonly fields?: Readonly<Record<string, ShownField | undefined>>
  readonly slides?: readonly string[]
  readonly nodes?: readonly NodeChoice[]
  readonly role?: string
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

function readsSize(reads: TraitReads): number {
  return reads["text.size"]?.value ?? 1800
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
      const unread = key === "fills.blur" && shown.fields?.[key] !== undefined && shown.fields[key]?.value == null
      if (
        (trait === "text" && field === "color") ||
        unread ||
        canvasControl(trait, field) ||
        !taken.includes(key) ||
        keptRefuses(view.kept, trait, field)
      )
        return []
      const copy = labels.fields[field]
      const own = shown.fields?.[key]?.own === true
      const reset = own && inheritable(trait, field) ? (copy?.reset ?? null) : null
      const held = shownOf(view, trait, field, shown)
      const over = held.inherited ? alphaFieldOver(trait, key.slice(trait.length + 1)) : undefined
      const seen = over === undefined ? undefined : shown.fields?.[`${trait}.${over}`]?.value
      const change =
        trait === "fills" && field === "overlay"
          ? overlayChange(view, shown)
          : key === "fills.crop" && taken.includes("box.w")
            ? cropChange(view, held.value)
            : (value: unknown) =>
                ({
                  target: { node: view.node },
                  [trait]: { [field]: typeof seen === "number" ? atShownAlpha(value, seen) : value },
                }) as SetChange
      const desc = shownDesc(kind, view.facts.grouped, held.value)
      const label = copy?.label ?? ""
      const text = readTextValue(view.value ?? "")
      const size =
        text?.flatMap((paragraph) => paragraph.runs).find((run) => run.text !== "")?.size ??
        shown.fields?.["text.size"]?.value ??
        readsSize(shown.reads)
      const number =
        trait === "text" && field === "letterSpacing"
          ? { numberScale: typeof size === "number" ? size / 10_000 : 0.18 }
          : {}
      const nodes = trait === "connection" && shown.nodes !== undefined ? { nodes: shown.nodes } : {}
      return [
        resolveControl({
          ...shownPlace(trait, field),
          label,
          desc,
          ...(shown.slides === undefined ? {} : { slides: shown.slides }),
          ...held,
          reset,
          ...nodes,
          ...number,
          change,
        }),
      ]
    })
    const visible = trait === "text" ? typographyControls(controls, view.textStyles ?? [], shown) : controls
    if (visible.length === 0) return []
    if (trait === "fills")
      return (["fills", "image", "crop"] as const).flatMap((place): PanelSection[] => {
        const placed = visible.filter((control) => control.trait === place)
        if (placed.length === 0) return []
        return [{ trait: place, label: sectionLabel(place, labels), open: true, strips: arrange(place, placed) }]
      })
    const strips = arrange(trait, visible)
    const section = { trait, label: labels.section ?? "", open: true, strips }
    if (trait !== "text") return [section]
    const spacing = visible.filter(({ field }) => field === "spaceBefore" || field === "spaceAfter")
    if (spacing.length === 0) return [section]
    return [
      {
        ...section,
        strips: strips.filter((strip) => !strip.some((control) => spacing.includes(control))),
      },
      {
        trait: "paragraphSpacing",
        label: textCopy.paragraphSpacing,
        open: false,
        strips: arrange("paragraphSpacing", spacing),
      },
    ]
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
      textFillSections(
        listEffects(
          appearanceSections(
            [
              ...alignSection,
              ...(kind === "text" ? content : withFillsList(content, view, shown, kind === "picture")),
              ...(opacity === null ? [] : [opacity]),
              ...(corners === null ? [] : [corners]),
            ],
            kind,
            endsOpen(kind, shown),
            shown,
          ),
          view,
          shown,
        ),
        kind,
      ),
      shown,
    ),
  }
}

function withFillsList(
  sections: readonly PanelSection[],
  view: ScopedElement,
  shown: PanelReads,
  picture: boolean,
): readonly PanelSection[] {
  return sections.map((section) => {
    const paint = section.strips.flat().find((control) => control.trait === "fills" && control.field === "paint")
    if (section.trait !== "fills" || paint === undefined) return section
    return { ...section, designStrips: fillsList(paint, view, shownFills(shown) ?? {}, picture) }
  })
}

function textFillSections(sections: readonly PanelSection[], kind: PanelKind | null): readonly PanelSection[] {
  if (kind !== "text") return sections
  return sections.flatMap((section): PanelSection[] => {
    if (section.trait === "fills")
      return [
        {
          ...section,
          trait: "boxFill",
          label: fillCopy.box,
          open: false,
          strips: section.strips.map((strip) =>
            strip.map((control) =>
              control.trait === "fills" && control.field === "paint" ? { ...control, label: fillCopy.box } : control,
            ),
          ),
        },
      ]
    if (section.trait !== "text") return [section]
    const controls = section.strips.flat()
    const fill = controls.find((control) => control.field === "fill")
    const strips = section.strips
      .map((strip) => strip.filter((control) => control !== fill))
      .filter((strip) => strip.length > 0)
    if (fill === undefined) return [{ ...section, strips }]
    const control = resolveControl({ ...fill, trait: "textFill", field: "value" })
    return [
      { ...section, strips },
      { trait: "textFill", label: fillCopy.section, open: true, strips: [[control]] },
    ]
  })
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
    return section === undefined || left.includes(section.trait) ? [] : [{ ...section, open: place.open }]
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
  const desc = lead.desc
  const choices =
    desc.kind === "choice"
      ? {
          ...desc,
          options: desc.options.filter((option) =>
            controls.every((control) => control.desc.kind === "choice" && control.desc.options.includes(option)),
          ),
        }
      : desc
  return {
    ...lead,
    desc: choices,
    ...(lead.choices === undefined
      ? {}
      : {
          choices: lead.choices.filter((choice) =>
            controls.every((control) => control.choices?.some((each) => each.value === choice.value)),
          ),
        }),
    value: mixed && !shared ? undefined : lead.value,
    mixed,
    inherited: !mixed && controls.every((control) => control.inherited),
    reset: null,
    change: (value) => ({ ...lead.change(value), target: { nodes } }),
  }
}

export function panelOfMany(models: readonly [PanelModel, ...PanelModel[]], mode: PanelMode): PanelModel {
  const nodes = models.flatMap((model) => model.nodes)
  const selectionKinds = models.map(({ kind }) => kind)
  const sections = panelPlaces("many", mode, selectionKinds).flatMap((place): PanelSection[] => {
    const found = present(
      models.map((model) => {
        const section = model.sections.find(({ trait }) => trait === place.section)
        if (section === undefined) return undefined
        const { designStrips: _list, ...single } = section
        return sectionInMode(section.trait === "fills" ? single : section, mode)
      }),
    )
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
  return { node: (rest.at(-1) ?? first).node, nodes, kind: "many", selectionKinds, sections }
}
