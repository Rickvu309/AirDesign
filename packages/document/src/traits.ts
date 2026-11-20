import type { Kind } from "./kinds.js"
import { body } from "./trait-body.js"
import { border } from "./trait-border.js"
import { box } from "./trait-box.js"
import { connection } from "./trait-connection.js"
import { dropSlots, effects, innerSlots } from "./trait-effects.js"
import { fills } from "./trait-fills.js"
import { geometry } from "./trait-geometry.js"
import { guides } from "./trait-guides.js"
import { identity } from "./trait-identity.js"
import { layout } from "./trait-layout.js"
import { link } from "./trait-link.js"
import { notes } from "./trait-notes.js"
import { show } from "./trait-show.js"
import { table } from "./trait-table.js"
import { chart } from "./trait-chart.js"
import { text } from "./trait-text.js"
import { templateStyle } from "./trait-template-style.js"
import { transition } from "./trait-transition.js"
import type { AgentOf, Alpha, Fields, ValueOf } from "./value-kind.js"

export const traits = {
  identity,
  link,
  box,
  geometry,
  fills,
  border,
  effects,
  body,
  text,
  connection,
  table,
  chart,
  notes,
  templateStyle,
  show,
  transition,
  guides,
  layout,
} as const

export type TraitName = keyof typeof traits
export type FieldKinds<T extends TraitName> = (typeof traits)[T]["fields"]
export type InputKinds<T extends TraitName> = (typeof traits)[T]["inputs"]
export type FieldName<T extends TraitName> = keyof FieldKinds<T> & string
export type InputName<T extends TraitName> = keyof InputKinds<T> & string
export type FieldValue<T extends TraitName, F extends FieldName<T>> = ValueOf<FieldKinds<T>[F]>
export type TraitValue<T extends TraitName> = { readonly [F in FieldName<T>]: FieldValue<T, F> }
export type FieldKey = { [T in TraitName]: `${T}.${FieldName<T>}` }[TraitName]
export type InheritableField<T extends TraitName> = (typeof traits)[T]["inheritable"][number] &
  (FieldName<T> | InputName<T>)

export type SlotField<T extends TraitName> = (typeof traits)[T]["slots"][number] & FieldName<T>

export type AlphaField<T extends TraitName> = {
  [F in FieldName<T>]: FieldValue<T, F> extends Alpha ? F : never
}[FieldName<T>]

export type HasAlpha = { [T in TraitName]: AlphaField<T> }[TraitName] extends never ? false : true

export type WireField<T extends TraitName> =
  | Exclude<FieldName<T>, AlphaField<T> | (T extends "effects" ? never : SlotField<T>)>
  | InputName<T>

export type WireAgent<T extends TraitName, F extends WireField<T>> =
  F extends FieldName<T>
    ? AgentOf<FieldKinds<T>[F]> | (F extends InheritableField<T> ? null : never)
    : F extends InputName<T>
      ? AgentOf<InputKinds<T>[F]> | (F extends InheritableField<T> ? null : never)
      : never

export const traitNames = Object.keys(traits) as readonly TraitName[]

export const kindTraits = {
  deck: ["templateStyle"],
  master: [],
  layout: [],
  section: [],
  slide: ["fills", "templateStyle", "show", "transition", "guides"],
  notes: ["notes"],
  shape: ["identity", "box", "geometry", "fills", "border", "effects", "body", "text", "link"],
  connector: ["identity", "box", "geometry", "border", "effects", "connection"],
  group: ["identity", "box", "effects", "layout"],
  table: ["identity", "box", "table"],
  row: [],
  cell: [],
  chart: ["identity", "box", "chart"],
  kept: ["identity"],
} as const satisfies { readonly [K in Kind]: readonly TraitName[] }

export function fieldKeys(trait: TraitName): readonly FieldKey[] {
  return Object.keys(traits[trait].fields).map((field) => `${trait}.${field}` as FieldKey)
}

export const alphaKeys: readonly FieldKey[] = traitNames.flatMap((trait) =>
  Object.entries(traits[trait].fields as Fields).flatMap(([field, kind]) =>
    kind.desc.kind === "alpha" ? [`${trait}.${field}` as FieldKey] : [],
  ),
)

export function inheritable(trait: TraitName, field: string): boolean {
  return (traits[trait].inheritable as readonly string[]).includes(field)
}

export function slotted(trait: TraitName, field: string): boolean {
  return (traits[trait].slots as readonly string[]).includes(field)
}

const replacing: Partial<Readonly<Record<TraitName, string>>> = { fills: "paint", geometry: "shape" }

export function keptRefuses(kept: readonly string[], trait: TraitName, field: string): boolean {
  if (kept.includes(`${trait}.${field}`)) return true
  if (trait === "effects") {
    if (dropSlots.some((slot) => slot === field) && kept.includes("effects.shadow")) return true
    if (innerSlots.some((slot) => slot === field) && kept.includes("effects.innerShadow")) return true
  }
  return kept.includes(trait) && replacing[trait] !== field
}
