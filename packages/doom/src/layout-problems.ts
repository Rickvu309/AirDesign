import { charsByFace } from "./measure.js"
import { deckOf } from "./deck-of.js"
import type { Doom, Write } from "./doom.js"
import { descendantsOf, propOf, slideOf, slidesOf } from "./doom-walk.js"
import { readNodeId, type NodeId } from "./ids.js"
import { type Backing, type Contrast, lowContrast, slideBase } from "./layout-contrast.js"
import { routeCrosses, strokeCrosses, strokeRoute, type StrokeRoute } from "./layout-line-crossing.js"
import { routeSpots } from "./line-ends.js"
import type { Measure } from "./measure.js"
import { textArea } from "./preset-geometry.js"
import { resolveSlide, slideBackground } from "./resolve-slide.js"
import type { Rgb } from "./color.js"
import type { Resolved, ResolvedLine } from "./resolved.js"
import { strokeDash } from "./stroke-dash.js"
import type { Text, TextStyleName } from "./text.js"
import type { Theme } from "./theme.js"

export type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

export type LayoutProblem = { readonly node: NodeId } & (
  | { readonly code: "overflow"; readonly need: number; readonly room: number; readonly ellipsis?: "w" | "h" }
  | { readonly code: "overlap"; readonly with: NodeId; readonly area: Rect }
  | { readonly code: "line-crosses-text"; readonly with: NodeId }
  | { readonly code: "rule-crosses-text"; readonly with: NodeId }
  | { readonly code: "off-slide"; readonly past: number; readonly whole: boolean }
  | { readonly code: "small-text"; readonly size: number; readonly min: number }
  | { readonly code: "lone-word"; readonly extra: number }
  | { readonly code: "low-contrast"; readonly ratio: number; readonly min: number }
)

export type ProblemRules = {
  readonly onHeight: number
  readonly loneWord: readonly TextStyleName[]
  readonly readable: number
  readonly contrast?: Contrast
  readonly thinRule?: number
}

const spill = 1
const pastEdge = 1
const crossing = 3

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
  readonly rules: ProblemRules
  readonly size: { readonly w: number; readonly h: number }
  readonly found: LayoutProblem[]
  readonly missing: MissingGlyphs
  readonly base: Rgb | null
  readonly backings: Backing[]
  readonly letters: { readonly id: NodeId; readonly inks: readonly Rect[] }[]
  readonly strokes: {
    readonly id: NodeId
    readonly code: "line-crosses-text" | "rule-crosses-text"
    readonly route: StrokeRoute
    readonly attached: ReadonlySet<NodeId>
  }[]
}

const onSlide = (slide: Slide, size: number) => (size * slide.size.h) / slide.rules.onHeight

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

const filled = (node: Resolved) => node.fills.some((paint) => paint.opacity > 0)
const painted = (node: Resolved) => filled(node) || node.strokes.length > 0

function paintedArea(node: Resolved, box: Rect): readonly Rect[] {
  const sides = node.stroke?.sides
  if (filled(node) || sides === undefined) return [box]
  const { t = 0, r = 0, b = 0, l = 0 } = sides
  return [
    { x: box.x, y: box.y, w: box.w, h: t },
    { x: right(box) - r, y: box.y, w: r, h: box.h },
    { x: box.x, y: bottom(box) - b, w: box.w, h: b },
    { x: box.x, y: box.y, w: l, h: box.h },
  ].filter((strip) => strip.w > 0 && strip.h > 0)
}

function place(slide: Slide, node: Resolved, x: number, y: number, ancestors: readonly Spin[], faded = 1): Placed {
  const box = { x: x + node.box.x, y: y + node.box.y, w: node.box.w, h: node.box.h }
  const chain = [...ancestors, { rotation: node.box.rotation, cx: box.x + box.w / 2, cy: box.y + box.h / 2 }]
  const alpha = faded * node.opacity
  const shown = alpha > 0
  if (shown && filled(node) && !node.mask) {
    const upright = chain.every((spin) => spin.rotation % 90 === 0)
    const exact = upright && (node.geometry === null || node.geometry.kind === "rect")
    slide.backings.push({ id: node.id, area: mapRect(chain, box), exact, paints: node.fills, alpha })
  }
  const below = slide.backings.length
  const origin = node.box.fit?.origin
  const laid = node.children.map((kid) =>
    place(slide, kid, box.x - (origin?.x ?? 0), box.y - (origin?.y ?? 0), chain, alpha),
  )
  judgeKids(slide, laid)
  const measured = node.text !== null && !unread(slide, node.id)
  const lines = node.text === null || !measured ? [] : node.text.lines.filter(written)
  const inked = lines.map((line) => ({ ink: mapRect(chain, inkOf(line, box.x, box.y)), runs: line.runs }))
  const ownInk = inked.map((line) => line.ink)
  const id = readNodeId(node.id)
  if (shown && id !== undefined) {
    if (ownInk.length > 0) slide.letters.push({ id, inks: ownInk })
    if (slide.rules.contrast !== undefined) {
      const { contrast } = slide.rules
      const large = onSlide(slide, contrast.large.size)
      const low = lowContrast(contrast, large, slide.base, slide.backings.slice(0, below), node.id, inked, alpha)
      if (low !== null) slide.found.push({ code: "low-contrast", node: id, ...low })
    }
    placeStroke(slide, id, node, box, chain)
    placeRule(slide, id, node, box, chain)
  }
  const inks = [...ownInk, ...laid.flatMap((kid) => kid.inks)]
  const frame = mapRect(chain, box)
  const line = node.geometry?.kind === "line"
  const content = line
    ? null
    : painted(node)
      ? union(paintedArea(node, box).map((area) => mapRect(chain, area)))
      : union(laid.flatMap((kid) => (kid.content === null ? kid.inks : [kid.content])))
  const bounds = union([frame, ...inks, ...laid.map((kid) => kid.bounds)]) ?? frame
  judgeOwn(slide, node, box, measured)
  return { node, box, inks, content, bounds }
}

function placeStroke(slide: Slide, id: NodeId, node: Resolved, box: Rect, chain: readonly Spin[]): void {
  const { geometry, stroke, strokes } = node
  if (geometry?.kind !== "line" || stroke === null || stroke.weight <= 0 || !strokes.some((paint) => paint.opacity > 0))
    return
  if (stroke.sides !== undefined && strokes[0]?.kind === "solid") return
  const points = routeSpots(geometry.points, geometry.route === "curve").map(({ x, y }) =>
    chain.reduceRight((at, spin) => turn(at.x, at.y, spin), {
      x: box.x + (node.box.flipH ? box.w - x : x),
      y: box.y + (node.box.flipV ? box.h - y : y),
    }),
  )
  const stored = propOf(slide.doom.nodes.get(id), "geometry")
  const attached = new Set<NodeId>()
  if (stored?.kind === "line")
    for (const end of [stored.start, stored.end])
      if ("node" in end) {
        attached.add(end.node)
        for (const layer of descendantsOf(slide.doom, end.node)) attached.add(layer.id)
      }
  const route = strokeRoute(points, stroke.weight / 2, strokeDash(stroke))
  slide.strokes.push({ id, code: "line-crosses-text", route, attached })
}

function placeRule(slide: Slide, id: NodeId, node: Resolved, box: Rect, chain: readonly Spin[]): void {
  const { thinRule } = slide.rules
  if (thinRule === undefined || !filled(node) || node.mask || node.children.length > 0 || !wordless(node)) return
  if (node.geometry !== null && node.geometry.kind !== "rect") return
  const across = box.w >= box.h
  const weight = across ? box.h : box.w
  if (weight <= 0 || weight >= onSlide(slide, thinRule)) return
  const ends = across
    ? [
        { x: box.x, y: box.y + weight / 2 },
        { x: right(box), y: box.y + weight / 2 },
      ]
    : [
        { x: box.x + weight / 2, y: box.y },
        { x: box.x + weight / 2, y: bottom(box) },
      ]
  const points = ends.map((end) => chain.reduceRight((at, spin) => turn(at.x, at.y, spin), end))
  slide.strokes.push({ id, code: "rule-crosses-text", route: strokeRoute(points, weight / 2, []), attached: new Set() })
}

function judgeStrokes(slide: Slide): void {
  for (const { id: line, code, route, attached } of slide.strokes) {
    const crosses = code === "rule-crosses-text" ? routeCrosses : strokeCrosses
    for (const { id: text, inks } of slide.letters) {
      if (line === text || attached.has(text) || !inks.some((ink) => crosses(route, ink, crossing))) continue
      slide.found.push({ code, node: text, with: line })
    }
  }
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

const words = new Intl.Segmenter(undefined, { granularity: "word" })

function judgeLastLine(slide: Slide, id: NodeId, text: Text, lines: readonly ResolvedLine[], width: number): void {
  if (!slide.rules.loneWord.includes(text.style)) return
  const last = lines.at(-1)
  const previous = lines.at(-2)
  if (last === undefined || previous === undefined || text.chars.slice(previous.start, last.start).includes("\n"))
    return
  const line = last.runs.map((run) => run.text).join("")
  if ([...words.segment(line)].filter((word) => word.isWordLike).length !== 1) return
  const full = slide.measure(text, slide.theme, null).lines.at(-1)
  if (full === undefined) return
  const extra = Math.max(0, Math.ceil(full.x + full.ink + (text.padding?.r ?? 0) - width))
  slide.found.push({ code: "lone-word", node: id, extra })
}

function judgeOwn(slide: Slide, node: Resolved, box: Rect, measured: boolean): void {
  const stored = slide.doom.nodes.get(node.id as NodeId)
  const text = stored === undefined ? undefined : propOf(stored, "text")
  if (stored === undefined || text === undefined || node.text === null) return
  if (text.resize === "fixed" && measured) {
    const area = textArea(propOf(stored, "geometry"), box.w, box.h)
    if (text.overflow === "ellipsis") {
      if (node.text.sourceLines !== undefined) {
        const excess = Math.max(0, ...node.text.sourceLines.map((line) => line.ink - line.w))
        const need = Math.ceil(excess > 0 ? area.w + excess : slide.measure(text, slide.theme, area.w).h)
        const room = Math.round(excess > 0 ? area.w : area.h)
        slide.found.push({ code: "overflow", node: stored.id, need, room, ellipsis: excess > 0 ? "w" : "h" })
      }
    } else {
      const need = Math.ceil(slide.measure(text, slide.theme, area.w).h)
      const room = Math.round(area.h)
      if (need > room + spill) slide.found.push({ code: "overflow", node: stored.id, need, room })
    }
  }
  if (measured && node.text.sourceLines === undefined) {
    const width = propOf(stored, "geometry")?.kind === "preset" ? Infinity : box.w
    judgeLastLine(slide, stored.id, text, node.text.lines, width)
  }
  const sizes = node.text.lines.flatMap((line) =>
    line.runs.filter((run) => run.text.trim() !== "").map((run) => run.size),
  )
  const min = Math.round(onSlide(slide, slide.rules.readable))
  const size = Math.min(...sizes)
  if (sizes.length > 0 && size < min) slide.found.push({ code: "small-text", node: stored.id, size, min })
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
      slide.found.push({ code: "overlap", node: node as NodeId, with: other as NodeId, area: rounded(area) })
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
  slide.found.push({ code: "off-slide", node: top.node.id as NodeId, past, whole })
}

export function layoutProblems(
  doom: Doom,
  slides: readonly NodeId[],
  measure: Measure,
  rules: ProblemRules,
  missing: MissingGlyphs = new Map(),
): readonly LayoutProblem[] {
  const { theme, size } = deckOf(doom)
  const found: LayoutProblem[] = []
  for (const id of slides) {
    if (doom.nodes.get(id)?.type !== "slide") continue
    const base = slideBase(slideBackground(doom, id))
    const slide: Slide = {
      doom,
      theme,
      measure,
      rules,
      size,
      found,
      missing,
      base,
      backings: [],
      letters: [],
      strokes: [],
    }
    const tops = resolveSlide(doom, id, measure).map((node) => place(slide, node, 0, 0, []))
    judgeKids(slide, tops)
    judgeStrokes(slide)
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
