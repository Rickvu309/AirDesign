import { linkXml } from "./trait-xml-link.js"
import type { TraitName, TraitPatch } from "@airdesign/document"
import { bodyXml, writtenBody } from "./trait-xml-body.js"
import { boxXml } from "./trait-xml-box.js"
import { connectionXml } from "./trait-xml-connection.js"
import { effectsXml } from "./trait-xml-effects.js"
import type { Faded } from "./alpha-codec.js"
import { fillAlpha, fillsXml, writtenFills } from "./trait-xml-fills.js"
import { geometryXml } from "./trait-xml-geometry.js"
import { guidesXml } from "./guide-list.js"
import { identityXml } from "./trait-xml-identity.js"
import { borderAlpha, borderXml } from "./trait-xml-border.js"
import { notesXml } from "./trait-xml-notes.js"
import { tableXml } from "./trait-xml-table.js"
import { chartXml } from "./trait-xml-chart.js"
import { textAlpha, textXml } from "./trait-xml-text.js"
import { showXml } from "./slide-show.js"
import { templateStyleXml } from "./trait-xml-template-style.js"
import { transitionXml } from "./trait-xml-transition.js"
import { coverOnResize } from "./picture-mode.js"
import { writeFields, type ElementAt, type Parts, type TraitXml } from "./xml-codec.js"

type Written = Exclude<TraitName, "layout">

export const traitXml: { readonly [T in Written]: TraitXml<T> } = {
  identity: identityXml,
  link: linkXml,
  box: boxXml,
  geometry: geometryXml,
  fills: fillsXml,
  border: borderXml,
  effects: effectsXml,
  body: bodyXml,
  text: textXml,
  connection: connectionXml,
  table: tableXml,
  chart: chartXml,
  notes: notesXml,
  templateStyle: templateStyleXml,
  show: showXml,
  transition: transitionXml,
  guides: guidesXml,
}

export function writeTrait<T extends TraitName>(parts: Parts, at: ElementAt, trait: T, patch: TraitPatch<T>): Parts {
  if (trait === "fills") return writtenFills(parts, at, patch as TraitPatch<"fills">)
  if (trait === "body") return writtenBody(parts, at, patch as TraitPatch<"body">)
  if (trait === "layout") return parts
  const next = writeFields(parts, at, traitXml[trait as Written], patch as TraitPatch<Written>)
  if (trait !== "box" || next === parts) return next
  return coverOnResize(parts, next, at)
}

export type ShownAlphas = { readonly fills: Faded; readonly border: Faded; readonly text: Faded }

export function shownAlphas(parts: Parts, at: ElementAt): ShownAlphas {
  return { fills: fillAlpha(parts, at), border: borderAlpha(parts, at), text: textAlpha(parts, at) }
}
