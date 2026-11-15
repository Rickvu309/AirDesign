import type { ResolvedElement, ResolvedSlide } from "./resolved-slide.js"
import { findingLimits, points, union, type Finding, type Placed, type Rect } from "./finding.js"
import { contrast } from "./contrast.js"

const emuPerPoint = 12_700

function meet(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const w = Math.min(a.x + a.w, b.x + b.w) - x
  const h = Math.min(a.y + a.h, b.y + b.h) - y
  return w > 0 && h > 0 ? { x, y, w, h } : null
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.w >= inner.x + inner.w &&
    outer.y + outer.h >= inner.y + inner.h
  )
}

const margins = new Set(["sldNum", "dt", "ftr"])

function covers(element: ResolvedElement): boolean {
  if (element.kind === "connector" || element.kind === "group" || element.kind === "picture") return false
  return element.kind !== "shape" || element.fill !== "none"
}

function widest(backs: readonly Rect[], fronts: readonly Rect[]): Rect | null {
  let best: Rect | null = null
  for (const back of backs)
    for (const front of fronts) {
      const shared = meet(back, front)
      if (shared === null || shared.w < findingLimits.overlap || shared.h < findingLimits.overlap) continue
      if (best === null || shared.w * shared.h > best.w * best.h) best = shared
    }
  return best
}

function apart(back: Rect, front: Rect, box: Rect, slide: ResolvedSlide): { readonly dx: number; readonly dy: number } {
  const width = slide.size.width / emuPerPoint
  const height = slide.size.height / emuPerPoint
  const moves = [
    { dx: 0, dy: back.y + back.h - front.y },
    { dx: 0, dy: back.y - front.y - front.h },
    { dx: back.x + back.w - front.x, dy: 0 },
    { dx: back.x - front.x - front.w, dy: 0 },
  ].sort((a, b) => Math.abs(a.dx + a.dy) - Math.abs(b.dx + b.dy))
  const fits = moves.find(
    (move) =>
      box.x + move.dx >= 0 &&
      box.y + move.dy >= 0 &&
      box.x + move.dx + box.w <= width &&
      box.y + move.dy + box.h <= height,
  )
  const move = fits ?? moves[0] ?? { dx: 0, dy: 0 }
  return { dx: points(move.dx), dy: points(move.dy) }
}

export function overlapFindings(slide: ResolvedSlide, placed: readonly Placed[]): readonly Finding[] {
  const found: Finding[] = []
  const judged = placed.filter(
    (place) =>
      place.element.from === "slide" &&
      !place.element.grouped &&
      place.element.rotation % 360 === 0 &&
      place.box !== null,
  )
  for (const [at, back] of judged.entries()) {
    if (back.glyphs.length === 0) continue
    for (const front of judged.slice(at + 1)) {
      const frontBox = front.box
      if (frontBox === null) continue
      const cover = covers(front.element)
      const fronts = cover ? [frontBox] : front.glyphs
      const area = widest(back.glyphs, fronts)
      if (area === null) continue
      found.push({
        slide: slide.slide,
        node: back.element.node,
        code: "overlap",
        level: "fault",
        other: front.element.node,
        by: cover ? "cover" : "text",
        area: { x: points(area.x), y: points(area.y), w: points(area.w), h: points(area.h) },
        fix: { node: front.element.node, ...apart(union(back.glyphs), union(fronts), frontBox, slide) },
      })
    }
  }
  return found
}

function backdrop(slide: ResolvedSlide, placed: readonly Placed[], at: number): string | null {
  const place = placed[at]
  if (place === undefined) return null
  const own = place.element.fill
  if (own === "unknown") return null
  if (own !== "none") return own.rgb
  const extent = union(place.glyphs)
  for (const behind of placed.slice(0, at).reverse()) {
    const { element } = behind
    if (element.kind === "connector" || element.kind === "group" || behind.box === null) continue
    const turned = element.rotation % 360 !== 0
    if (meet(behind.box, extent) === null && !turned) continue
    if (element.kind === "shape" && element.fill === "none") continue
    if (turned || element.kind !== "shape" || element.fill === "unknown" || element.fill === "none") return null
    return contains(behind.box, extent) ? element.fill.rgb : null
  }
  return slide.background === "none" || slide.background === "unknown" ? null : slide.background.rgb
}

export function contrastFindings(slide: ResolvedSlide, placed: readonly Placed[]): readonly Finding[] {
  const found: Finding[] = []
  for (const [at, place] of placed.entries()) {
    const { element, glyphs } = place
    const text = element.text
    if (element.from !== "slide" || text === null || glyphs.length === 0) continue
    if (margins.has(element.placeholder ?? "")) continue
    const behind = backdrop(slide, placed, at)
    if (behind === null) continue
    let worst: { readonly ratio: number; readonly needs: number; readonly text: string } | null = null
    for (const paragraph of text.paragraphs)
      for (const run of paragraph.runs) {
        if (run.color === null || run.text.trim() === "") continue
        const size = run.size * text.fontScale
        const large = size >= findingLimits.largeText || (run.bold && size >= findingLimits.largeBold)
        const needs = large ? findingLimits.largeContrast : findingLimits.contrast
        const ratio = contrast(run.color.rgb, behind)
        if (worst === null || ratio / needs < worst.ratio / worst.needs) worst = { ratio, needs, text: run.color.rgb }
      }
    if (worst === null || worst.ratio >= worst.needs) continue
    found.push({
      slide: slide.slide,
      node: element.node,
      code: "low-contrast",
      level: "fault",
      ratio: points(worst.ratio),
      needs: worst.needs,
      text: worst.text,
      behind,
      fix: { color: contrast("000000", behind) >= contrast("FFFFFF", behind) ? "000000" : "FFFFFF" },
    })
  }
  return found
}
