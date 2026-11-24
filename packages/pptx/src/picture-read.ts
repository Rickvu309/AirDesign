import { type Color, type FieldValue } from "@airdesign/document"
import { blurPercent } from "./picture-adjust.js"
import { pictureAt, svgEmbed, linkTarget, embedded, type PictureFill } from "./blip-edit.js"
import { colorsIn } from "./color-read.js"
import { decodedXmlText, type MarkupElement } from "./element-span.js"
import { whole } from "./markup-held.js"
import { iconOfPart, type IconColor, type IconRef } from "./picture-write.js"
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

const nonVisualByElements = new WeakMap<readonly MarkupElement[], ReadonlyMap<string, MarkupElement>>()
const indexedNonVisualThreshold = 64

export function nonVisualOf(elements: readonly MarkupElement[], shape: string): MarkupElement | undefined {
  if (elements.length < indexedNonVisualThreshold) {
    for (const each of elements) {
      if (each.kind === "p:cNvPr" && each.id === shape) return each
    }
    return undefined
  }
  let known = nonVisualByElements.get(elements)
  if (known === undefined) {
    const found = new Map<string, MarkupElement>()
    for (const each of elements) {
      if (each.kind === "p:cNvPr" && each.id !== null && !found.has(each.id)) found.set(each.id, each)
    }
    nonVisualByElements.set(elements, found)
    known = found
  }
  return known.get(shape)
}
