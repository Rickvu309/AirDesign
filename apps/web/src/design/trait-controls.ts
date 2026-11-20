import { slideListCopy } from "@/copy/slide-list-copy"
import type { SlotField, TraitName, WireField } from "@airdesign/document"
import { bodyControls } from "./trait-controls-body"
import { borderControls } from "./trait-controls-border"
import { boxControls } from "./trait-controls-box"
import { connectionControls } from "./trait-controls-connection"
import { effectsControls } from "./trait-controls-effects"
import { fillsControls } from "./trait-controls-fills"
import { geometryControls } from "./trait-controls-geometry"
import { identityControls } from "./trait-controls-identity"
import { layoutControls } from "./trait-controls-layout"
import { linkControls } from "./trait-controls-link"
import { notesControls } from "./trait-controls-notes"
import { textControls } from "./trait-controls-text"
import { guideCopy } from "@/copy/guide-copy"
import { transitionCopy } from "@/copy/transition-copy"
import { templateStyleControls } from "./trait-controls-template-style"

export type FieldCopy = {
  readonly label: string
  readonly reset?: string
}

type PanelField<T extends TraitName> = Exclude<WireField<T>, SlotField<T>>

export type TraitControls<T extends TraitName> = [T extends "table" ? never : PanelField<T>] extends [never]
  ? { readonly fields: Readonly<Record<never, never>> }
  : { readonly section: string; readonly fields: { readonly [F in PanelField<T>]-?: FieldCopy } }

export const traitControls: { readonly [T in TraitName]: TraitControls<T> } = {
  identity: identityControls,
  link: linkControls,
  box: boxControls,
  geometry: geometryControls,
  fills: fillsControls,
  border: borderControls,
  effects: effectsControls,
  body: bodyControls,
  text: textControls,
  connection: connectionControls,
  table: { fields: {} },
  layout: layoutControls,
  notes: notesControls,
  templateStyle: templateStyleControls,
  show: { section: slideListCopy.listName, fields: { skipped: { label: slideListCopy.skip } } },
  transition: { section: transitionCopy.transition, fields: { value: { label: transitionCopy.style } } },
  guides: {
    section: guideCopy.guides,
    fields: { ruler: { label: guideCopy.guides }, layout: { label: guideCopy.layoutGuide } },
  },
}
