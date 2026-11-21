import { points, type Finding, type Rect } from "./finding.js"
import type { ResolvedElement, ResolvedSlide } from "./resolved-slide.js"

export const alignLimits = { same: 0.5, least: 1, most: 2.5, gap: 48, width: 18, height: 12 } as const

const furniture = new Set(["sldNum", "ftr", "dt"])

type Edge = "left" | "right" | "top" | "bottom"
type Laid = { readonly element: ResolvedElement; readonly rect: Rect }

const emuPerPoint = 12_700

const edges: readonly (readonly [Edge, "x" | "y", (rect: Rect) => number])[] = [
  ["left", "x", (rect) => rect.x],
  ["right", "x", (rect) => rect.x + rect.w],
  ["top", "y", (rect) => rect.y],
  ["bottom", "y", (rect) => rect.y + rect.h],
]

function spans(from: number, to: number, start: number, end: number): boolean {
  return Math.min(to, end) - Math.max(from, start) > 0
}

function gap(from: number, to: number, start: number, end: number): number {
  return Math.max(from, start) - Math.min(to, end)
}

function lined(a: Rect, b: Rect, axis: "x" | "y"): boolean {
  const across = spans(a.x, a.x + a.w, b.x, b.x + b.w)
  const down = spans(a.y, a.y + a.h, b.y, b.y + b.h)
  return axis === "x" ? across && !down : down && !across
}

function beside(a: Rect, b: Rect, axis: "x" | "y"): boolean {
  if (!lined(a, b, axis)) return false
  const between = axis === "x" ? gap(a.y, a.y + a.h, b.y, b.y + b.h) : gap(a.x, a.x + a.w, b.x, b.x + b.w)
  return between <= alignLimits.gap
}

function judged(slide: ResolvedSlide): readonly Laid[] {
  return slide.elements.flatMap((element) => {
    const { box } = element
    if (element.from !== "slide" || element.grouped || element.rotation % 360 !== 0) return []
    if (element.kind === "connector" || box === null || furniture.has(element.placeholder ?? "")) return []
    if (element.fill === "none" || element.fill === "unknown") return []
    const rect = { x: box.x / emuPerPoint, y: box.y / emuPerPoint, w: box.cx / emuPerPoint, h: box.cy / emuPerPoint }
    return rect.w < alignLimits.width || rect.h < alignLimits.height ? [] : [{ element, rect }]
  })
}

export function alignFindings(slide: ResolvedSlide): readonly Finding[] {
  const laid = judged(slide)
  const found = new Map<string, Finding>()
  for (const [edge, axis, at] of edges) {
    const matches = (one: Laid) =>
      laid
        .filter((other) => other !== one && lined(one.rect, other.rect, axis))
        .filter((other) => Math.abs(at(other.rect) - at(one.rect)) <= alignLimits.same).length
    for (const [index, a] of laid.entries())
      for (const b of laid.slice(index + 1)) {
        if (!beside(a.rect, b.rect, axis)) continue
        const by = Math.abs(at(a.rect) - at(b.rect))
        if (by <= alignLimits.least || by > alignLimits.most) continue
        const [moved, kept] = matches(a) > matches(b) ? [b, a] : [a, b].sort((x, y) => matches(x) - matches(y))
        if (moved === undefined || kept === undefined) continue
        const key = `${moved.element.node} ${axis}`
        if (found.has(key)) continue
        const shift = at(kept.rect) - at(moved.rect)
        found.set(key, {
          slide: slide.slide,
          node: moved.element.node,
          code: "misaligned",
          level: "fault",
          other: kept.element.node,
          edge,
          by: points(by),
          fix: axis === "x" ? { x: points(moved.rect.x + shift) } : { y: points(moved.rect.y + shift) },
        })
      }
  }
  return [...found.values()]
}
