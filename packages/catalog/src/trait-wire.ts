import type { TraitName, WireAgent, WireField } from "@airdesign/document"
import { bodyWire } from "./trait-wire-body.js"
import { borderWire } from "./trait-wire-border.js"
import { boxWire } from "./trait-wire-box.js"
import { connectionWire } from "./trait-wire-connection.js"
import { effectsWire } from "./trait-wire-effects.js"
import { fillsWire } from "./trait-wire-fills.js"
import { geometryWire } from "./trait-wire-geometry.js"
import { identityWire } from "./trait-wire-identity.js"
import { layoutWire } from "./trait-wire-layout.js"
import { linkWire } from "./trait-wire-link.js"
import { notesWire } from "./trait-wire-notes.js"
import { textWire } from "./trait-wire-text.js"
import { templateStyleWire } from "./trait-wire-template-style.js"
import { transitionWire } from "./trait-wire-transition.js"

export type FieldWire<T extends TraitName, F extends WireField<T>> = {
  readonly description: string
  readonly example: { readonly [K in T]: { readonly [P in F]: WireAgent<T, F> } }
}

export type TraitWire<T extends TraitName> = [T extends "table" ? never : WireField<T>] extends [never]
  ? { readonly fields: Readonly<Record<never, never>> }
  : {
      readonly description: string
      readonly fields: { readonly [F in WireField<T>]-?: FieldWire<T, F> }
    }

export const traitWire: { readonly [T in TraitName]: TraitWire<T> } = {
  identity: identityWire,
  link: linkWire,
  box: boxWire,
  geometry: geometryWire,
  fills: fillsWire,
  border: borderWire,
  effects: effectsWire,
  body: bodyWire,
  text: textWire,
  connection: connectionWire,
  table: { fields: {} },
  layout: layoutWire,
  notes: notesWire,
  templateStyle: templateStyleWire,
  show: {
    description: "Slides only.",
    fields: { skipped: { description: "Skip in Present.", example: { show: { skipped: true } } } },
  },
  transition: transitionWire,
}
