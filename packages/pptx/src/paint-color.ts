import { gamma, hexRgb, hslRgb, paintSteps, presetColors, rgbHex, type Rgb } from "@airdesign/document"
import type { EditorShade } from "./editor-gradient.js"
import type { MarkupElement } from "./element-span.js"
import type { MarkupChildren } from "./text-value-route.js"
import type { PaintImage } from "./paint-image.js"

export type PaintColor = { hex: string; alpha: number }

export type PaintGradientPath = {
  kind: "circle" | "rect" | "shape"
  focus: { left: number; top: number; right: number; bottom: number } | null
}

export type PaintFill =
  | { type: "none" }
  | { type: "solid"; color: PaintColor }
  | {
      type: "gradient"
      stops: readonly { position: number; color: PaintColor }[]
      angle: number | null
      path: PaintGradientPath | null
      editor?: EditorShade
    }
  | { type: "pattern"; preset: string; foreground: PaintColor; background: PaintColor }
  | ({ type: "picture" } & PaintImage)

export type PaintPalette = {
  children: MarkupChildren
  slots: ReadonlyMap<string, MarkupElement>
  mapping: ReadonlyMap<string, string>
  placeholder: PaintColor | null
}

export const paintAttribute = (element: MarkupElement, name: string): string | null =>
  element.attributes.find((item) => item.name === name)?.value ?? null

const clamp = (value: number): number => Math.max(0, Math.min(1, value))
const numeric = (element: MarkupElement, name: string): number | null => {
  const value = paintAttribute(element, name)
  return value !== null && /^[+-]?\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null
}

const baseColor = (
  element: MarkupElement,
  palette: PaintPalette,
  seen: ReadonlySet<MarkupElement>,
): PaintColor | Rgb | null => {
  const value = paintAttribute(element, "val")
  switch (element.kind) {
    case "a:srgbClr":
      return hexRgb(value)
    case "a:sysClr":
      return hexRgb(paintAttribute(element, "lastClr"))
    case "a:prstClr":
      return hexRgb(presetColors.get(value ?? "") ?? null)
    case "a:scrgbClr": {
      const channels = ["r", "g", "b"].map((name) => numeric(element, name))
      return channels.some((channel) => channel === null)
        ? null
        : (channels.map((channel) => gamma(clamp((channel ?? 0) / 100000))) as unknown as Rgb)
    }
    case "a:hslClr": {
      const hue = numeric(element, "hue")
      const saturation = numeric(element, "sat")
      const lightness = numeric(element, "lum")
      return hue === null || saturation === null || lightness === null
        ? null
        : hslRgb([hue / 21600000, clamp(saturation / 100000), clamp(lightness / 100000)])
    }
    case "a:schemeClr": {
      if (value === "phClr") return palette.placeholder
      const slot = palette.slots.get(palette.mapping.get(value ?? "") ?? value ?? "")
      const color = slot === undefined ? undefined : palette.children[slot.index]?.[0]
      return color === undefined ? null : paintColor(color, palette.children, palette, seen)
    }
    default:
      return null
  }
}

export const paintColor = (
  element: MarkupElement,
  children: MarkupChildren,
  palette: PaintPalette,
  seen: ReadonlySet<MarkupElement> = new Set(),
): PaintColor | null => {
  if (seen.has(element)) return null
  const next = new Set(seen).add(element)
  const base = baseColor(element, palette, next)
  if (base === null) return null
  const start: Rgb = "hex" in base ? hexRgb(base.hex)! : base
  const steps = (children[element.index] ?? []).map((transform) => ({
    op: transform.kind.slice(2),
    val: numeric(transform, "val"),
  }))
  const painted = paintSteps(start, "hex" in base ? base.alpha : 1, steps)
  return painted === null ? null : { hex: rgbHex(painted.rgb), alpha: painted.alpha }
}
