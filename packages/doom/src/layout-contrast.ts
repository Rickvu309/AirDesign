import { channels, contrastRatio, over, type Rgb } from "./color.js"
import type { Rect } from "./layout-problems.js"
import type { ResolvedPaint, ResolvedRun } from "./resolved.js"

export type Contrast = { readonly min: number; readonly large: { readonly size: number; readonly min: number } }

export type Backing = {
  readonly id: string
  readonly area: Rect
  readonly exact: boolean
  readonly paints: readonly ResolvedPaint[]
  readonly alpha: number
}

export type InkLine = { readonly ink: Rect; readonly runs: readonly ResolvedRun[] }

const white: Rgb = [255, 255, 255]
const edge = 3

const covers = (outer: Rect, inner: Rect) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.w >= inner.x + inner.w &&
  outer.y + outer.h >= inner.y + inner.h

const touches = (a: Rect, b: Rect) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) >= edge &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) >= edge

type Coat = { readonly color: Rgb; readonly alpha: number }

const laid = (coats: readonly Coat[], start: Rgb): Rgb =>
  coats.reduceRight((back, coat) => over(coat.color, coat.alpha, back), start)

export function slideBase(paints: readonly ResolvedPaint[]): Rgb | null {
  let back = white
  for (const paint of paints) {
    if (paint.kind !== "solid") return null
    back = over(channels(paint.color), paint.opacity, back)
  }
  return back
}

function backdrop(backings: readonly Backing[], own: string, ink: Rect, base: Rgb | null): Rgb | null {
  const coats: Coat[] = []
  for (const backing of backings.toReversed()) {
    if (!touches(backing.area, ink)) continue
    if (backing.id !== own && !(backing.exact && covers(backing.area, ink))) return null
    for (const paint of backing.paints.toReversed()) {
      if (paint.opacity <= 0) continue
      if (paint.kind !== "solid") return null
      const coat = { color: channels(paint.color), alpha: paint.opacity * backing.alpha }
      if (coat.alpha >= 1) return laid(coats, coat.color)
      coats.push(coat)
    }
  }
  return base === null ? null : laid(coats, base)
}

export function lowContrast(
  contrast: Contrast,
  large: number,
  base: Rgb | null,
  backings: readonly Backing[],
  own: string,
  lines: readonly InkLine[],
  alpha: number,
): { readonly ratio: number; readonly min: number } | null {
  let worst: { readonly ratio: number; readonly min: number } | null = null
  for (const { ink, runs } of lines) {
    const back = backdrop(backings, own, ink, base)
    if (back === null) continue
    for (const run of runs) {
      if (run.text.trim() === "") continue
      const min = run.size >= large ? contrast.large.min : contrast.min
      const ratio = contrastRatio(over(channels(run.color), alpha, back), back)
      if (ratio < min && (worst === null || ratio / min < worst.ratio / worst.min))
        worst = { ratio: Math.floor(ratio * 100) / 100, min }
    }
  }
  return worst
}
