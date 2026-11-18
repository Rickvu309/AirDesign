import type { MarkupElement } from "./element-span.js"
import { paintAttribute, paintColor, type PaintColor, type PaintPalette } from "./paint-color.js"
import { paintChild } from "./paint-fill.js"
import type { MarkupChildren } from "./text-value-route.js"

export type PaintShadow = {
  blur: number
  distance: number
  direction: number
  scaleX: number
  scaleY: number
  skewX: number
  skewY: number
  align: string
  rotateWithShape: boolean
  color: PaintColor
}

export type PaintGlow = { radius: number; color: PaintColor }

export type PaintInner = {
  blur: number
  distance: number
  direction: number
  color: PaintColor
}

export type PaintEffects = {
  shadow?: PaintShadow
  innerShadow?: PaintInner
  glow?: PaintGlow
  softEdge?: { radius: number }
  blur?: { radius: number }
  drops?: readonly PaintShadow[]
  inners?: readonly PaintInner[]
}

const alignments = ["tl", "t", "tr", "l", "ctr", "r", "bl", "b", "br"]
const anglesPerDegree = 60000
const percentPerUnit = 100000

const whole = (element: MarkupElement, name: string): number | null => {
  const value = paintAttribute(element, name)
  return value !== null && /^[+-]?\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null
}

const size = (element: MarkupElement, name: string): number | null => {
  const value = whole(element, name)
  return value === null || value < 0 ? null : value
}

const colorOf = (children: MarkupChildren, element: MarkupElement, palette: PaintPalette): PaintColor | null => {
  const color = children[element.index]?.[0]
  return color === undefined ? null : paintColor(color, children, palette)
}

const flag = (element: MarkupElement, name: string): boolean => {
  const value = paintAttribute(element, name)
  return value === "0" || value === "false" ? false : true
}

const shadowOf = (children: MarkupChildren, element: MarkupElement, palette: PaintPalette): PaintShadow | null => {
  const color = colorOf(children, element, palette)
  if (color === null) return null
  const align = paintAttribute(element, "algn")
  return {
    blur: size(element, "blurRad") ?? 0,
    distance: size(element, "dist") ?? 0,
    direction: ((((size(element, "dir") ?? 0) / anglesPerDegree) % 360) + 360) % 360,
    scaleX: (whole(element, "sx") ?? percentPerUnit) / percentPerUnit,
    scaleY: (whole(element, "sy") ?? percentPerUnit) / percentPerUnit,
    skewX: (whole(element, "kx") ?? 0) / anglesPerDegree,
    skewY: (whole(element, "ky") ?? 0) / anglesPerDegree,
    align: align !== null && alignments.includes(align) ? align : "b",
    rotateWithShape: flag(element, "rotWithShape"),
    color,
  }
}

export const paintEffects = (
  children: MarkupChildren,
  list: MarkupElement,
  palette: PaintPalette,
): PaintEffects | undefined => {
  const effects: PaintEffects = {}
  const shadowElement = paintChild(children, list, "a:outerShdw")
  const shadow = shadowElement === undefined ? null : shadowOf(children, shadowElement, palette)
  if (shadow !== null) effects.shadow = shadow
  const glowElement = paintChild(children, list, "a:glow")
  const glowRadius = glowElement === undefined ? null : size(glowElement, "rad")
  const glowColor = glowElement === undefined ? null : colorOf(children, glowElement, palette)
  if (glowRadius !== null && glowRadius > 0 && glowColor !== null)
    effects.glow = { radius: glowRadius, color: glowColor }
  const softElement = paintChild(children, list, "a:softEdge")
  const softRadius = softElement === undefined ? null : size(softElement, "rad")
  if (softRadius !== null && softRadius > 0) effects.softEdge = { radius: softRadius }
  const innerElement = paintChild(children, list, "a:innerShdw")
  const innerColor = innerElement === undefined ? null : colorOf(children, innerElement, palette)
  if (innerElement !== undefined && innerColor !== null)
    effects.innerShadow = {
      blur: size(innerElement, "blurRad") ?? 0,
      distance: size(innerElement, "dist") ?? 0,
      direction: ((((size(innerElement, "dir") ?? 0) / anglesPerDegree) % 360) + 360) % 360,
      color: innerColor,
    }
  const blurElement = paintChild(children, list, "a:blur")
  const blurRadius = blurElement === undefined ? null : size(blurElement, "rad")
  if (blurRadius !== null && blurRadius > 0) effects.blur = { radius: blurRadius }
  return Object.keys(effects).length === 0 ? undefined : effects
}
