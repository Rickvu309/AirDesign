import { linkXml } from "./trait-xml-link.js"
import type { TraitName, TraitPatch } from "@airdesign/document"
import { bodyXml } from "./trait-xml-body.js"
import { boxXml } from "./trait-xml-box.js"
import { connectionXml } from "./trait-xml-connection.js"
import { cropXml } from "./trait-xml-crop.js"
import { effectsXml } from "./trait-xml-effects.js"
import type { Faded } from "./alpha-codec.js"
import { fillAlpha, fillsXml } from "./trait-xml-fills.js"
import { geometryXml } from "./trait-xml-geometry.js"
import { identityXml } from "./trait-xml-identity.js"
import { imageXml } from "./trait-xml-image.js"
import { lineAlpha, lineXml } from "./trait-xml-line.js"
import { notesXml } from "./trait-xml-notes.js"
import { tableXml } from "./trait-xml-table.js"
import { textAlpha, textXml } from "./trait-xml-text.js"
import { showXml } from "./slide-show.js"
import { templateXml } from "./trait-xml-template.js"
import { themeXml } from "./trait-xml-theme.js"
import { transitionXml } from "./trait-xml-transition.js"
import { writeFields, type ElementAt, type Parts, type TraitXml } from "./xml-codec.js"

export const traitXml: { readonly [T in TraitName]: TraitXml<T> } = {
  identity: identityXml,
  link: linkXml,
  box: boxXml,
  geometry: geometryXml,
  fills: fillsXml,
  line: lineXml,
  effects: effectsXml,
  body: bodyXml,
  text: textXml,
  image: imageXml,
  crop: cropXml,
  connection: connectionXml,
  table: tableXml,
  notes: notesXml,
  theme: themeXml,
  template: templateXml,
  show: showXml,
  transition: transitionXml,
}

export function writeTrait<T extends TraitName>(parts: Parts, at: ElementAt, trait: T, patch: TraitPatch<T>): Parts {
  return writeFields(parts, at, traitXml[trait], patch)
}

export type ShownAlphas = { readonly fills: Faded; readonly line: Faded; readonly text: Faded }

export function shownAlphas(parts: Parts, at: ElementAt): ShownAlphas {
  return { fills: fillAlpha(parts, at), line: lineAlpha(parts, at), text: textAlpha(parts, at) }
}
