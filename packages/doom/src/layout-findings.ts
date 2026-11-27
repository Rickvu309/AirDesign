import { charsByFace } from "./measure.js"
import { deckOf } from "./deck-of.js"
import type { Doom, Write } from "./doom.js"
import { descendantsOf, propOf, slideOf, slidesOf } from "./doom-walk.js"
import type { NodeId } from "./ids.js"
import type { Measure } from "./measure.js"
import { textArea } from "./preset-geometry.js"
import { resolveSlide } from "./resolve-slide.js"
import type { Resolved, ResolvedLine } from "./resolved.js"
import type { Theme } from "./theme.js"

export type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

export type LayoutFinding = { readonly node: NodeId; readonly note: string } & (
  | { readonly code: "overflow"; readonly need: number; readonly room: number }
  | { readonly code: "overlap"; readonly with: NodeId; readonly area: Rect }
  | { readonly code: "off-slide"; readonly past: number }
  | { readonly code: "small-text"; readonly size: number; readonly min: number }
)

const spill = 1
const pastEdge = 1
const crossing = 3
const readableAt1080 = 20
const referenceHeight = 1080

type Placed = {
  readonly node: Resolved
  readonly box: Rect
  readonly inks: readonly Rect[]
  readonly content: Rect | null
  readonly bounds: Rect
}

type Slide = {
  readonly doom: Doom
  readonly theme: Theme
  readonly measure: Measure
  readonly size: { readonly w: number; readonly h: number }
  readonly found: LayoutFinding[]
  readonly missing: MissingGlyphs
}

const right = (rect: Rect) => rect.x + rect.w
const bottom = (rect: Rect) => rect.y + rect.h

function union(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null
  const x = Math.min(...rects.map((rect) => rect.x))
  const y = Math.min(...rects.map((rect) => rect.y))
  return { x, y, w: Math.max(...rects.map(right)) - x, h: Math.max(...rects.map(bottom)) - y }
}

function meet(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const w = Math.min(right(a), right(b)) - x
  const h = Math.min(bottom(a), bottom(b)) - y
  return w >= crossing && h >= crossing ? { x, y, w, h } : null
}

const contains = (outer: Rect, inner: Rect) =>
  outer.x <= inner.x && outer.y <= inner.y && right(outer) >= right(inner) && bottom(outer) >= bottom(inner)

type Spin = { readonly rotation: number; readonly cx: number; readonly cy: number }

function turn(x: number, y: number, spin: Spin): { readonly x: number; readonly y: number } {
  if (spin.rotation % 360 === 0) return { x, y }
  const angle = (spin.rotation * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = x - spin.cx
  const dy = y - spin.cy
  return { x: spin.cx + dx * cos - dy * sin, y: spin.cy + dx * sin + dy * cos }
}

function mapRect(spins: readonly Spin[], rect: Rect): Rect {
  if (spins.every((spin) => spin.rotation % 360 === 0)) return rect
  let left = Infinity
  let top = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const px of [rect.x, right(rect)])
    for (const py of [rect.y, bottom(rect)]) {
      const point = spins.reduceRight((at, spin) => turn(at.x, at.y, spin), { x: px, y: py })
      left = Math.min(left, point.x)
      top = Math.min(top, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  return { x: left, y: top, w: maxX - left, h: maxY - top }
}

const written = (line: ResolvedLine) => line.runs.some((run) => run.text.trim() !== "")

const wordless = (node: Resolved): boolean => node.text === null || !node.text.lines.some(written)

function inkOf(line: ResolvedLine, x: number, y: number): Rect {
  const free = Math.max(0, line.w - line.ink)
  const shift = line.align === "center" ? free / 2 : line.align === "right" ? free : 0
  const left = line.label === undefined ? x + line.x + shift : x + line.label.x
  const em = Math.min(line.h, Math.max(...line.runs.map((run) => run.size)))
  return { x: left, y: y + line.y + (line.h - em) / 2, w: x + line.x + shift + line.ink - left, h: em }
}

const painted = (node: Resolved) => node.fills.some((paint) => paint.opacity > 0) || node.strokes.length > 0

function place(slide: Slide, node: Resolved, x: number, y: number, ancestors: readonly Spin[]): Placed {
  const box = { x: x + node.box.x, y: y + node.box.y, w: node.box.w, h: node.box.h }
  const chain = [...ancestors, { rotation: node.box.rotation, cx: box.x + box.w / 2, cy: box.y + box.h / 2 }]
  const laid = node.children.map((kid) => place(slide, kid, box.x, box.y, chain))
  judgeKids(slide, laid)
  const lines =
    node.text === null || unread(slide, node.id)
      ? []
      : node.text.lines.filter(written).map((line) => inkOf(line, box.x, box.y))
  const inks = [...lines.map((ink) => mapRect(chain, ink)), ...laid.flatMap((kid) => kid.inks)]
  const frame = mapRect(chain, box)
  const line = node.geometry?.kind === "line"
  const content = line
    ? null
    : painted(node)
      ? frame
      : union(laid.flatMap((kid) => (kid.content === null ? kid.inks : [kid.content])))
  const bounds = union([frame, ...inks, ...laid.map((kid) => kid.bounds)]) ?? frame
  judgeOwn(slide, node, box)
  return { node, box, inks, content, bounds }
}

export type MissingGlyphs = ReadonlyMap<string, ReadonlySet<string>>

export function missingGlyphsIn(doom: Doom, id: NodeId, missing: MissingGlyphs): readonly string[] {
  const text = propOf(doom.nodes.get(id), "text")
  if (missing.size === 0 || text === undefined) return []
  const chars = new Set<string>()
  for (const [face, letters] of charsByFace(text, deckOf(doom).theme)) {
    const absent = missing.get(face)
    for (const letter of letters) if (absent?.has(letter)) chars.add(letter)
  }
  return [...chars]
}

const unread = (slide: Slide, id: string) => missingGlyphsIn(slide.doom, id as NodeId, slide.missing).length > 0

function judgeOwn(slide: Slide, node: Resolved, box: Rect): void {
  const stored = slide.doom.nodes.get(node.id as NodeId)
  const text = stored === undefined ? undefined : propOf(stored, "text")
  if (stored === undefined || text === undefined || node.text === null) return
  if (text.resize === "fixed" && !unread(slide, stored.id)) {
    const area = textArea(propOf(stored, "geometry"), box.w, box.h)
    if (text.overflow === "ellipsis") {
      if (node.text.sourceLines !== undefined) {
        const excess = Math.max(0, ...node.text.sourceLines.map((line) => line.ink - line.w))
        const need = Math.ceil(excess > 0 ? area.w + excess : slide.measure(text, slide.theme, area.w).h)
        const room = Math.round(excess > 0 ? area.w : area.h)
        const resize = excess > 0 ? " or make the box wider" : need > room ? " or make the box taller" : ""
        slide.found.push({
          code: "overflow",
          node: stored.id,
          need,
          room,
          note: `${stored.id}: the label was shortened to fit. Use fewer words${resize}.`,
        })
      }
    } else {
      const need = Math.ceil(slide.measure(text, slide.theme, area.w).h)
      const room = Math.round(area.h)
      if (need > room + spill)
        slide.found.push({
          code: "overflow",
          node: stored.id,
          need,
          room,
          note: `${stored.id}: its words need ${String(need)} px of height and its box holds ${String(room)}, so they spill out; make the box at least ${String(need)} tall or cut words.`,
        })
    }
  }
  const sizes = node.text.lines.flatMap((line) =>
    line.runs.filter((run) => run.text.trim() !== "").map((run) => run.size),
  )
  const min = Math.round((readableAt1080 * slide.size.h) / referenceHeight)
  const size = Math.min(...sizes)
  if (sizes.length > 0 && size < min)
    slide.found.push({
      code: "small-text",
      node: stored.id,
      size,
      min,
      note: `${stored.id}: text at ${String(size)} px is under the ${String(min)} px a room can read on this slide.`,
    })
}

function crossed(back: Placed, front: Placed): Rect | null {
  const meets: Rect[] = []
  const add = (a: readonly Rect[], b: readonly Rect[]) => {
    for (const one of a)
      for (const two of b) {
        const shared = meet(one, two)
        if (shared !== null) meets.push(shared)
      }
  }
  add(back.inks, front.inks)
  if (front.content !== null) add(back.inks, [front.content])
  const frontInk = union(front.inks)
  if (back.content !== null && frontInk !== null && !contains(back.content, frontInk)) add(front.inks, [back.content])
  return union(meets)
}

const rounded = (rect: Rect): Rect => ({
  x: Math.round(rect.x),
  y: Math.round(rect.y),
  w: Math.round(rect.w),
  h: Math.round(rect.h),
})

function judgeKids(slide: Slide, kids: readonly Placed[]): void {
  for (const [at, back] of kids.entries())
    for (const front of kids.slice(at + 1)) {
      const area = crossed(back, front)
      if (area === null) continue
      const [node, other] = back.inks.length > 0 ? [back.node.id, front.node.id] : [front.node.id, back.node.id]
      const shown = rounded(area)
      slide.found.push({
        code: "overlap",
        node: node as NodeId,
        with: other as NodeId,
        area: shown,
        note: `${node}: its words and ${other} overlap over ${String(shown.w)}x${String(shown.h)} px at ${String(shown.x)},${String(shown.y)}; move one clear of the other.`,
      })
    }
}

function coversSlide(slide: Slide, top: Placed): boolean {
  const { box, node } = top
  return (
    node.children.length === 0 &&
    (node.geometry === null || node.geometry.kind === "rect") &&
    node.fills.some((paint) => paint.opacity > 0) &&
    node.opacity > 0 &&
    wordless(node) &&
    node.box.rotation % 360 === 0 &&
    contains(box, { x: 0, y: 0, w: slide.size.w, h: slide.size.h })
  )
}

function judgeEdges(slide: Slide, top: Placed): void {
  const { bounds } = top
  const { w, h } = slide.size
  const past = Math.round(Math.max(0, -bounds.x, -bounds.y, right(bounds) - w, bottom(bounds) - h))
  if (past <= pastEdge) return
  if (coversSlide(slide, top)) return
  const whole = bounds.x >= w || bounds.y >= h || right(bounds) <= 0 || bottom(bounds) <= 0
  slide.found.push({
    code: "off-slide",
    node: top.node.id as NodeId,
    past,
    note: whole
      ? `${top.node.id}: it lies wholly off the slide, where no one sees it.`
      : `${top.node.id}: it runs ${String(past)} px past the slide's edge, where the slide cuts it off.`,
  })
}

export function layoutFindings(
  doom: Doom,
  slides: readonly NodeId[],
  measure: Measure,
  missing: MissingGlyphs = new Map(),
): readonly LayoutFinding[] {
  const { theme, size } = deckOf(doom)
  const found: LayoutFinding[] = []
  for (const id of slides) {
    if (doom.nodes.get(id)?.type !== "slide") continue
    const slide: Slide = { doom, theme, measure, size, found, missing }
    const tops = resolveSlide(doom, id, measure).map((node) => place(slide, node, 0, 0, []))
    judgeKids(slide, tops)
    for (const top of tops) judgeEdges(slide, top)
  }
  return found
}

export function unmeasuredTexts(doom: Doom, slides: readonly NodeId[], missing: MissingGlyphs): readonly NodeId[] {
  if (missing.size === 0) return []
  return slides.flatMap((slide) =>
    descendantsOf(doom, slide).flatMap((node) => (missingGlyphsIn(doom, node.id, missing).length > 0 ? [node.id] : [])),
  )
}

const laysOut = (prop: string) =>
  prop === "theme" || prop === "size" || prop.startsWith("theme.fonts.") || prop.startsWith("theme.textStyles.")

export function touchedSlides(
  before: Doom,
  after: Doom,
  writes: readonly Pick<Write, "node" | "prop">[],
): readonly NodeId[] {
  const decked = (write: Pick<Write, "node" | "prop">) => after.nodes.get(write.node)?.type === "deck"
  if (writes.some((write) => decked(write) && laysOut(write.prop))) return slidesOf(after).map((slide) => slide.id)
  const slides = new Set<NodeId>()
  for (const write of writes) {
    if (decked(write)) continue
    const slide = slideOf(after, write.node) ?? slideOf(before, write.node)
    if (slide !== undefined && after.nodes.get(slide)?.type === "slide") slides.add(slide)
  }
  return [...slides]
}
