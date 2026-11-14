import type { TraitName, WireField } from "@airdesign/document"
import { bodyControls } from "./trait-controls-body"
import { boxControls } from "./trait-controls-box"
import { connectionControls } from "./trait-controls-connection"
import { cropControls } from "./trait-controls-crop"
import { effectsControls } from "./trait-controls-effects"
import { fillControls } from "./trait-controls-fill"
import { geometryControls } from "./trait-controls-geometry"
import { identityControls } from "./trait-controls-identity"
import { imageControls } from "./trait-controls-image"
import { lineControls } from "./trait-controls-line"
import { notesControls } from "./trait-controls-notes"
import { tableControls } from "./trait-controls-table"
import { textControls } from "./trait-controls-text"

export type FieldCopy = {
  readonly label: string
  readonly reset?: string
}

export type TraitControls<T extends TraitName> = [WireField<T>] extends [never]
  ? { readonly fields: Readonly<Record<never, never>> }
  : { readonly section: string; readonly fields: { readonly [F in WireField<T>]-?: FieldCopy } }

export const traitControls: { readonly [T in TraitName]: TraitControls<T> } = {
  identity: identityControls,
  box: boxControls,
  geometry: geometryControls,
  fill: fillControls,
  line: lineControls,
  effects: effectsControls,
  body: bodyControls,
  text: textControls,
  image: imageControls,
  crop: cropControls,
  connection: connectionControls,
  table: tableControls,
  notes: notesControls,
}
