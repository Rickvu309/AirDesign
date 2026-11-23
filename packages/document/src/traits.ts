import { body } from "./trait-body.js"
import { border } from "./trait-border.js"
import { box } from "./trait-box.js"
import { connection } from "./trait-connection.js"
import { effects } from "./trait-effects.js"
import { fills } from "./trait-fills.js"
import { geometry } from "./trait-geometry.js"
import { guides } from "./trait-guides.js"
import { identity } from "./trait-identity.js"
import { layout } from "./trait-layout.js"
import { link } from "./trait-link.js"
import { notes } from "./trait-notes.js"
import { show } from "./trait-show.js"
import { text } from "./trait-text.js"
import { templateStyle } from "./trait-template-style.js"
import { transition } from "./trait-transition.js"
import type { ValueOf } from "./value-kind.js"

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
  notes,
  templateStyle,
  show,
  transition,
  guides,
  layout,
} as const

export type TraitName = keyof typeof traits
export type FieldKinds<T extends TraitName> = (typeof traits)[T]["fields"]
export type FieldName<T extends TraitName> = keyof FieldKinds<T> & string
export type FieldValue<T extends TraitName, F extends FieldName<T>> = ValueOf<FieldKinds<T>[F]>
export type TraitValue<T extends TraitName> = { readonly [F in FieldName<T>]: FieldValue<T, F> }

export const traitNames = Object.keys(traits) as readonly TraitName[]
