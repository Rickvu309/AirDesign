import { formatCopy } from "@/copy/format-copy"
import type { Desc } from "./control-desc"
import type { Color, NodeId } from "@airdesign/doom"
import type { TypedUnit } from "./typed-number"
import type { CSSProperties, ReactNode } from "react"
import { optionWord } from "@/copy/option-copy"
import type { Palette } from "./color-choices"
import { panelPlaces, sectionInMode, type PanelKind, type PanelMode } from "./panel-order"
import { arrange, resolveControl, type ControlKind, type ControlLook } from "./panel-arrangement"
export type { ControlKind } from "./panel-arrangement"

export type SectionName =
  | "alignment"
  | "box"
  | "text"
  | "textFill"
  | "fills"
  | "pictureFill"
  | "image"
  | "opacity"
  | "corners"
  | "border"
  | "shadow"
  | "link"
  | "geometry"
  | "templateStyle"
  | "fillDetails"

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
  readonly typed?: TypedUnit
  readonly parent?: unknown
  readonly slides?: readonly string[]
  readonly faceFallback?: () => string | null
}

export type PanelGradient = {
  readonly stops: readonly { readonly pos: number; readonly color: Color }[]
  readonly shade:
    | { readonly linear: { readonly angle: number; readonly scaled: boolean } }
    | {
        readonly path: {
          readonly kind: "circle"
          readonly focus: { readonly l: number; readonly t: number; readonly r: number; readonly b: number }
        }
      }
  readonly rotateWithShape: boolean
}

export type PanelPaint =
  | { readonly none: true }
  | { readonly solid: Color }
  | { readonly gradient: PanelGradient }
  | { readonly image: string | true | null }

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
  readonly node: NodeId
  readonly nodes: readonly NodeId[]
  readonly kind: PanelKind | null
  readonly frame?: "auto" | "free"
  readonly selectionKinds?: readonly (PanelKind | null)[]
  readonly sections: readonly PanelSection[]
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

function manyControl(controls: readonly PanelControl[], lead: PanelControl): PanelControl {
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
      const each = present(found.map((section) => section.strips.flat().find(({ field }) => field === control.field)))
      return each === null ? [] : [manyControl(each, control)]
    })
    return controls.length === 0 ? [] : [{ ...lead, open: place.open, strips: arrange(lead.trait, controls) }]
  })
  const [first, ...rest] = models
  return { node: (rest.at(-1) ?? first).node, nodes, kind: "many", selectionKinds, sections }
}
