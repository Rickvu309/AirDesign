import {
  mappedSlots,
  templateColors,
  type Color,
  type ColorTransform,
  type FillRead,
  type MappedSlot,
  type TemplateColor,
} from "@airdesign/document"
import type { MarkupElement } from "./element-span.js"
import { child, inside, whole, type Held } from "./markup-held.js"
import { paintAttribute } from "./paint-color.js"

export const fillKinds = new Set(["a:noFill", "a:solidFill", "a:gradFill", "a:pattFill", "a:blipFill", "a:grpFill"])
const colorKinds = new Set(["a:schemeClr", "a:srgbClr", "a:sysClr", "a:prstClr", "a:scrgbClr", "a:hslClr"])
const transformOps = new Set([
  "alpha",
  "alphaMod",
  "alphaOff",
  "tint",
  "shade",
  "lum",
  "lumMod",
  "lumOff",
  "sat",
  "satMod",
  "satOff",
  "hue",
  "hueMod",
  "hueOff",
  "red",
  "redMod",
  "redOff",
  "green",
  "greenMod",
  "greenOff",
  "blue",
  "blueMod",
  "blueOff",
])
const bareOps = new Set(["comp", "inv", "gray", "gamma", "invGamma"])

function transformOf(element: MarkupElement): ColorTransform | null {
  const op = element.kind.slice(2)
  if (bareOps.has(op)) return { op } as ColorTransform
  const val = whole(element, "val")
  return transformOps.has(op) && val !== undefined ? ({ op, val } as ColorTransform) : null
}

function colorOf(held: Held, placed: Color | null): Color | null {
  const element = held.element
  const value = paintAttribute(element, "val")
  let base: Color | null = null
  if (element.kind === "a:schemeClr" && value === "phClr") base = placed
  else if (element.kind === "a:schemeClr")
    base =
      templateColors.find((slot) => slot === value) !== undefined ||
      mappedSlots.find((slot) => slot === value) !== undefined
        ? { scheme: value as TemplateColor | MappedSlot }
        : null
  else if (element.kind === "a:srgbClr" && value !== null && /^[0-9A-Fa-f]{6}$/.test(value))
    base = { rgb: value.toUpperCase() }
  else if (element.kind === "a:sysClr") {
    const last = paintAttribute(element, "lastClr")
    base =
      value !== null && last !== null && /^[0-9A-Fa-f]{6}$/.test(last)
        ? { system: value, last: last.toUpperCase() }
        : null
  } else if (element.kind === "a:prstClr" && value !== null) base = { preset: value }
  if (base === null) return null
  const transforms = inside(held).flatMap((item) => {
    const transform = transformOf(item)
    return transform === null ? [] : [transform]
  })
  const kept = [...(base.transforms ?? []), ...transforms]
  return kept.length === 0 ? base : { ...base, transforms: kept }
}

export function colorsIn(held: Held, placed: Color | null): readonly (Color | null)[] {
  return inside(held)
    .filter((item) => colorKinds.has(item.kind))
    .map((element) => colorOf({ ...held, element }, placed))
}

export function colorIn(held: Held | undefined, placed: Color | null): Color | null {
  const element = held === undefined ? undefined : inside(held).find((item) => colorKinds.has(item.kind))
  return held === undefined || element === undefined ? null : colorOf({ ...held, element }, placed)
}

export function fillOf(held: Held, placed: Color | null): FillRead | "none" | null {
  switch (held.element.kind) {
    case "a:noFill":
      return "none"
    case "a:solidFill": {
      const color = colorIn(held, placed)
      return color === null ? null : { color }
    }
    case "a:gradFill": {
      const stops = inside(child(held, "a:gsLst") ?? held).flatMap((stop) => {
        const color = stop.kind === "a:gs" ? colorIn({ ...held, element: stop }, placed) : null
        return color === null ? [] : [color]
      })
      return stops.length === 0 ? null : { gradient: stops }
    }
    case "a:pattFill": {
      const preset = paintAttribute(held.element, "prst")
      return preset === null ? null : { pattern: preset }
    }
    case "a:blipFill":
      return "image"
    case "a:grpFill":
      return "group"
  }
  return null
}

export const fillIn = (held: Held | undefined): Held | undefined => {
  const element = held === undefined ? undefined : inside(held).find((item) => fillKinds.has(item.kind))
  return held === undefined || element === undefined ? undefined : { ...held, element }
}
