import { fillMode } from "./picture-mode.js"
import { iconWeights, type Color, type CropRead, type FieldValue, type RecolorRead } from "@airdesign/document"
import { shownLocked } from "./shape-locks.js"
import { shownMask } from "./mask-extension.js"
import { blurPercent } from "./picture-adjust.js"
import { pictureAt, svgEmbed, linkTarget, embedded, type PictureFill } from "./blip-edit.js"
import { colorsIn } from "./color-read.js"
import { decodedXmlText, type MarkupElement } from "./element-span.js"
import { whole, type Held } from "./markup-held.js"
import { iconInk, iconOfPart, type IconColor, type IconRef } from "./picture-write.js"
import { requireMarkup } from "./part-markup.js"
import type { Drawn, Sheet } from "./paint-sheet.js"
import type { MarkupChildren } from "./text-value-route.js"
import type { ElementAt, Parts } from "./xml-codec.js"

export type Recolor = FieldValue<"fills", "recolor">
export type Overlay = { readonly none: true } | { readonly solid: Color }
export type CropRect = FieldValue<"fills", "crop">

export type ShownImage = {
  readonly source: string | null
  readonly weight: number | null
  readonly color: Color | null
  readonly alpha: number
  readonly recolor: Recolor
  readonly blur: number | null
  readonly overlay: Overlay | null
}

export type ShownIdentity = {
  readonly name: string
  readonly alt: string
  readonly hidden: boolean
  readonly locked: boolean
  readonly mask: boolean
}

const opaque = 100_000

function effect(found: PictureFill, blip: MarkupElement, kind: string): MarkupElement | undefined {
  return found.children[blip.index]?.find((each) => each.kind === kind)
}

export function iconOf(parts: Parts, part: string, children: MarkupChildren, blip: MarkupElement): IconRef | null {
  const id = svgEmbed(children, blip)
  const target = id === null ? null : linkTarget(parts, part, id)
  return target === null ? null : iconOfPart(target)
}

export function iconColorOf(color: IconColor): Color {
  if (color.scheme === undefined) return { rgb: color.hex }
  return { scheme: color.scheme, ...(color.transforms === undefined ? {} : { transforms: color.transforms }) }
}

export function shownIcon(parts: Parts, at: ElementAt): IconRef | null {
  const found = pictureAt(parts, at)
  const blip = found?.blip
  if (found === null || blip === undefined || embedded(blip) === null) return null
  return iconOf(parts, at.part, found.children, blip)
}

export function heldIcon(parts: Parts, part: string, held: Held): IconRef | null {
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

function named(element: MarkupElement, name: string): string | null {
  const found = element.attributes.find((each) => each.name === name)
  return found === undefined ? null : decodedXmlText(found.value)
}

export function blipBlur(found: PictureFill, blip: MarkupElement): number | null {
  const blur = effect(found, blip, "a:blur")
  if (blur === undefined) return 0
  const radius = blur.attributes.some((each) => each.name === "rad") ? whole(blur, "rad") : 0
  return radius === undefined || radius < 0 ? null : blurPercent(radius)
}

export function blipOverlay(found: PictureFill, blip: MarkupElement): Overlay | null {
  const overlay = effect(found, blip, "a:fillOverlay")
  if (overlay === undefined) return { none: true }
  if (named(overlay, "blend") !== "over") return null
  const solid = found.children[overlay.index]?.find((each) => each.kind === "a:solidFill")
  if (solid === undefined) return null
  const [color, ...rest] = colorsIn({ element: solid, children: found.children }, null)
  return color == null || rest.length > 0 ? null : { solid: color }
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
  const icon = embedded(blip) === null ? null : iconOf(parts, at.part, found.children, blip)
  return {
    source: icon?.name ?? null,
    weight: icon?.weight ?? null,
    color: icon === null ? null : iconColorOf(icon.color),
    alpha,
    recolor,
    blur: blipBlur(found, blip),
    overlay: blipOverlay(found, blip),
  }
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
  return {
    name: text(element, "name"),
    alt: text(element, "descr"),
    hidden: hidden === "1" || hidden === "true",
    locked: shownLocked(parts, at) === true,
    mask: shownMask(parts, at) === true,
  }
}

const altShown = 60

export type PictureReads = {
  fills?: { readonly value: "image" }
  "fills.source"?: { readonly value: string }
  "fills.weight"?: { readonly value: number }
  "fills.color"?: { readonly value: Color }
  "fills.mode"?: { readonly value: string }
  "fills.recolor"?: { readonly value: RecolorRead }
  "fills.crop"?: { readonly value: CropRead }
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
  reads.fills = { value: "image" }
  const icon = iconOf(parts, sheet.part, sheet.children, blip)
  if (icon !== null) reads["fills.source"] = { value: icon.name }
  if (icon !== null && icon.weight !== iconWeights.lucide) reads["fills.weight"] = { value: icon.weight }
  if (icon !== null && (icon.color.hex !== iconInk.hex || icon.color.scheme !== undefined))
    reads["fills.color"] = { value: iconColorOf(icon.color) }
  const found = { bytes: sheet.bytes, elements: sheet.elements, children: sheet.children, fill, blip }
  const mode = fillMode(found)
  if (mode !== "stretch") reads["fills.mode"] = { value: mode }
  const recolor = recolorOf(found, blip)
  if (recolor !== null && "grayscale" in recolor) reads["fills.recolor"] = { value: "grayscale" }
  if (recolor !== null && "duotone" in recolor) reads["fills.recolor"] = { value: recolor.duotone }
  const rect = sheet.children[fill.index]?.find((each) => each.kind === "a:srcRect")
  const [l, t, r, b] = ["l", "t", "r", "b"].map((name) => side(rect, name))
  if (l != null && t != null && r != null && b != null && l + t + r + b > 0)
    reads["fills.crop"] = { value: { l, t, r, b } }
  return reads
}
