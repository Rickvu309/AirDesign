import type { Kind } from "./properties.js"
import { body } from "./trait-body.js"
import { box } from "./trait-box.js"
import { connection } from "./trait-connection.js"
import { crop } from "./trait-crop.js"
import { effects } from "./trait-effects.js"
import { fill } from "./trait-fill.js"
import { geometry } from "./trait-geometry.js"
import { identity } from "./trait-identity.js"
import { image } from "./trait-image.js"
import { line } from "./trait-line.js"
import { notes } from "./trait-notes.js"
import { table } from "./trait-table.js"
import { text } from "./trait-text.js"
import type { Alpha, ValueOf } from "./value-kind.js"

export const traits = {
  identity,
  box,
  geometry,
  fill,
  line,
  effects,
  body,
  text,
  image,
  crop,
  connection,
  table,
  notes,
} as const

export type TraitName = keyof typeof traits
export type FieldKinds<T extends TraitName> = (typeof traits)[T]["fields"]
export type InputKinds<T extends TraitName> = (typeof traits)[T]["inputs"]
export type FieldName<T extends TraitName> = keyof FieldKinds<T> & string
export type InputName<T extends TraitName> = keyof InputKinds<T> & string
export type FieldValue<T extends TraitName, F extends FieldName<T>> = ValueOf<FieldKinds<T>[F]>
export type TraitValue<T extends TraitName> = { readonly [F in FieldName<T>]: FieldValue<T, F> }
export type FieldKey = { [T in TraitName]: `${T}.${FieldName<T>}` }[TraitName]

export type AlphaField<T extends TraitName> = {
  [F in FieldName<T>]: FieldValue<T, F> extends Alpha ? F : never
}[FieldName<T>]

export type HasAlpha = { [T in TraitName]: AlphaField<T> }[TraitName] extends never ? false : true

export type WireField<T extends TraitName> = Exclude<FieldName<T>, AlphaField<T>> | InputName<T>

export const traitNames = Object.keys(traits) as readonly TraitName[]

export const kindTraits = {
  deck: [],
  theme: [],
  master: [],
  layout: [],
  section: [],
  slide: ["notes"],
  shape: ["identity", "box", "geometry", "fill", "line", "effects", "body", "text"],
  picture: ["identity", "box", "geometry", "line", "effects", "image", "crop"],
  connector: ["identity", "box", "geometry", "line", "effects", "connection"],
  group: ["identity", "box", "effects"],
  table: ["identity", "box", "table"],
  row: [],
  cell: [],
  chart: ["identity", "box"],
  kept: ["identity"],
} as const satisfies { readonly [K in Kind]: readonly TraitName[] }

export function fieldKeys(trait: TraitName): readonly FieldKey[] {
  return Object.keys(traits[trait].fields).map((field) => `${trait}.${field}` as FieldKey)
}
