import type { TraitName, TraitPatch } from "@airdesign/document"
import { bodyXml } from "./trait-xml-body.js"
import { boxXml } from "./trait-xml-box.js"
import { connectionXml } from "./trait-xml-connection.js"
import { cropXml } from "./trait-xml-crop.js"
import { effectsXml } from "./trait-xml-effects.js"
import type { Faded } from "./alpha-codec.js"
import { fillAlpha, fillXml } from "./trait-xml-fill.js"
import { geometryXml } from "./trait-xml-geometry.js"
import { identityXml } from "./trait-xml-identity.js"
import { imageXml } from "./trait-xml-image.js"
import { lineAlpha, lineXml } from "./trait-xml-line.js"
import { notesXml } from "./trait-xml-notes.js"
import { tableXml } from "./trait-xml-table.js"
import { textAlpha, textXml } from "./trait-xml-text.js"
import { writeFields, type ElementAt, type Parts, type TraitXml } from "./xml-codec.js"

export const traitXml: { readonly [T in TraitName]: TraitXml<T> } = {
  identity: identityXml,
  box: boxXml,
  geometry: geometryXml,
  fill: fillXml,
  line: lineXml,
  effects: effectsXml,
  body: bodyXml,
  text: textXml,
  image: imageXml,
  crop: cropXml,
  connection: connectionXml,
  table: tableXml,
  notes: notesXml,
}

export function writeTrait<T extends TraitName>(parts: Parts, at: ElementAt, trait: T, patch: TraitPatch<T>): Parts {
  return writeFields(parts, at, traitXml[trait], patch)
}

export type ShownAlphas = { readonly fill: Faded; readonly line: Faded; readonly text: Faded }

export function shownAlphas(parts: Parts, at: ElementAt): ShownAlphas {
  return { fill: fillAlpha(parts, at), line: lineAlpha(parts, at), text: textAlpha(parts, at) }
}
