import type { CropRead, FieldValue, RecolorRead } from "@airdesign/document"
import { pictureAt, svgEmbed, linkTarget, embedded, type PictureFill } from "./blip-edit.js"
import { colorsIn } from "./color-read.js"
import { decodedXmlText, type MarkupElement } from "./element-span.js"
import { whole, type Held } from "./markup-held.js"
import { iconOfPart } from "./picture-write.js"
import { requireMarkup } from "./part-markup.js"
import type { Drawn, Sheet } from "./paint-sheet.js"
import type { MarkupChildren } from "./text-value-route.js"
import type { ElementAt, Parts } from "./xml-codec.js"

export type Recolor = FieldValue<"image", "recolor">
export type CropRect = FieldValue<"crop", "rect">

export type ShownImage = { readonly source: string | null; readonly alpha: number; readonly recolor: Recolor }

export type ShownIdentity = { readonly name: string; readonly alt: string; readonly hidden: boolean }

const opaque = 100_000

function effect(found: PictureFill, blip: MarkupElement, kind: string): MarkupElement | undefined {
  return found.children[blip.index]?.find((each) => each.kind === kind)
}

export function iconOf(parts: Parts, part: string, children: MarkupChildren, blip: MarkupElement): string | null {
  const id = svgEmbed(children, blip)
  const target = id === null ? null : linkTarget(parts, part, id)
  return target === null ? null : iconOfPart(target)
}

export function heldIcon(parts: Parts, part: string, held: Held): string | null {
  const blip = held.children[held.element.index]?.find((each) => each.kind === "a:blip")
  return blip === undefined ? null : iconOf(parts, part, held.children, blip)
}

export function recolorOf(found: PictureFill, blip: MarkupElement): Recolor | null {
  if (effect(found, blip, "a:grayscl") !== undefined) return { grayscale: true }
  const duotone = effect(found, blip, "a:duotone")
  if (duotone === undefined) return { none: true }
  const [dark, light, ...rest] = colorsIn({ element: duotone, children: found.children }, null)
  return dark == null || light == null || rest.length > 0 ? null : { duotone: { dark, light } }
}

export function blipAlpha(found: PictureFill, blip: MarkupElement): number | null {
  const fixed = effect(found, blip, "a:alphaModFix")
  if (fixed === undefined) return opaque
  const amount = fixed.attributes.some((each) => each.name === "amt") ? whole(fixed, "amt") : opaque
  return amount === undefined || amount < 0 || amount > opaque ? null : amount
}

export function shownImage(parts: Parts, at: ElementAt): ShownImage | null {
  const found = pictureAt(parts, at)
  const blip = found?.blip
  if (found === null || blip === undefined) return null
  const recolor = recolorOf(found, blip)
  const alpha = blipAlpha(found, blip)
  if (recolor === null || alpha === null) return null
  return { source: embedded(blip) === null ? null : iconOf(parts, at.part, found.children, blip), alpha, recolor }
}

function side(element: MarkupElement | undefined, name: string): number | null {
  if (element === undefined || !element.attributes.some((each) => each.name === name)) return 0
  const value = whole(element, name)
  return value === undefined || value < 0 || value > opaque ? null : value
}

export function shownCrop(parts: Parts, at: ElementAt): CropRect | null {
  const found = pictureAt(parts, at)
  if (found === null) return null
  const rect = found.children[found.fill.index]?.find((each) => each.kind === "a:srcRect")
  const [l, t, r, b] = ["l", "t", "r", "b"].map((name) => side(rect, name))
  return l == null || t == null || r == null || b == null ? null : { l, t, r, b }
}

export function nonVisualOf(elements: readonly MarkupElement[], shape: string): MarkupElement | undefined {
  return elements.find((each) => each.kind === "p:cNvPr" && each.id === shape)
}

function text(element: MarkupElement, name: string): string {
  const found = element.attributes.find((each) => each.name === name)
  return found === undefined ? "" : decodedXmlText(found.value)
}

export function shownIdentity(parts: Parts, at: ElementAt): ShownIdentity | null {
  const bytes = parts.get(at.part)
  const element = bytes === undefined ? undefined : nonVisualOf(requireMarkup(bytes).elements, at.shape)
  if (element === undefined) return null
  const hidden = text(element, "hidden")
  return { name: text(element, "name"), alt: text(element, "descr"), hidden: hidden === "1" || hidden === "true" }
}

const altShown = 60

export type PictureReads = {
  "image.source"?: { readonly value: string }
  "image.recolor"?: { readonly value: RecolorRead }
  crop?: { readonly value: CropRead }
  "identity.alt"?: { readonly value: string }
  "identity.hidden"?: { readonly value: boolean }
}

export function pictureReads(parts: Parts, sheet: Sheet, item: Drawn): PictureReads {
  const reads: PictureReads = {}
  const alt = text(item.identity, "descr").trim()
  if (alt !== "") reads["identity.alt"] = { value: alt.length > altShown ? `${alt.slice(0, altShown - 1)}…` : alt }
  if (text(item.identity, "hidden") === "1" || text(item.identity, "hidden") === "true")
    reads["identity.hidden"] = { value: true }
  if (item.kind !== "p:pic") return reads
  const fill = sheet.children[item.element.index]?.find((each) => each.kind === "p:blipFill")
  const blip = fill === undefined ? undefined : sheet.children[fill.index]?.find((each) => each.kind === "a:blip")
  if (fill === undefined || blip === undefined) return reads
  const icon = iconOf(parts, sheet.part, sheet.children, blip)
  if (icon !== null) reads["image.source"] = { value: icon }
  const found = { bytes: sheet.bytes, elements: sheet.elements, children: sheet.children, fill, blip }
  const recolor = recolorOf(found, blip)
  if (recolor !== null && "grayscale" in recolor) reads["image.recolor"] = { value: "grayscale" }
  if (recolor !== null && "duotone" in recolor) reads["image.recolor"] = { value: recolor.duotone }
  const rect = sheet.children[fill.index]?.find((each) => each.kind === "a:srcRect")
  const [l, t, r, b] = ["l", "t", "r", "b"].map((name) => side(rect, name))
  if (l != null && t != null && r != null && b != null && l + t + r + b > 0) reads.crop = { value: { l, t, r, b } }
  return reads
}
