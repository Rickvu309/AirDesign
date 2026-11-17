import type { TraitName, WireAgent, WireField } from "@airdesign/document"
import { bodyWire } from "./trait-wire-body.js"
import { boxWire } from "./trait-wire-box.js"
import { connectionWire } from "./trait-wire-connection.js"
import { cropWire } from "./trait-wire-crop.js"
import { effectsWire } from "./trait-wire-effects.js"
import { fillWire } from "./trait-wire-fill.js"
import { geometryWire } from "./trait-wire-geometry.js"
import { identityWire } from "./trait-wire-identity.js"
import { imageWire } from "./trait-wire-image.js"
import { lineWire } from "./trait-wire-line.js"
import { notesWire } from "./trait-wire-notes.js"
import { textWire } from "./trait-wire-text.js"
import { themeWire } from "./trait-wire-theme.js"

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
  box: boxWire,
  geometry: geometryWire,
  fill: fillWire,
  line: lineWire,
  effects: effectsWire,
  body: bodyWire,
  text: textWire,
  image: imageWire,
  crop: cropWire,
  connection: connectionWire,
  table: { fields: {} },
  notes: notesWire,
  theme: themeWire,
}
