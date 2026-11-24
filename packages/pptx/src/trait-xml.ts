import { linkXml } from "./trait-xml-link.js"
import type { TraitName, TraitPatch } from "@airdesign/document"
import { bodyXml, writtenBody } from "./trait-xml-body.js"
import { boxXml } from "./trait-xml-box.js"
import { connectionXml } from "./trait-xml-connection.js"
import { effectsXml } from "./trait-xml-effects.js"
import { fillsXml, writtenFills } from "./trait-xml-fills.js"
import { geometryXml } from "./trait-xml-geometry.js"
import { guidesXml } from "./guide-list.js"
import { identityXml } from "./trait-xml-identity.js"
import { borderXml } from "./trait-xml-border.js"
import { notesXml } from "./trait-xml-notes.js"
import { textXml } from "./trait-xml-text.js"
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
