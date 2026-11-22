import type { Box } from "./box.js"
import { alignFindings } from "./finding-align.js"
import { contrastFindings, overlapFindings } from "./finding-cover.js"
import { scaleFindings } from "./finding-scale.js"
import { findingLimits, points, union, type Finding, type Placed, type Rect } from "./finding.js"
import type { ResolvedElement, ResolvedSlide, ResolvedText } from "./resolved-slide.js"
import { layText, type FontWidths, type TextLayout, type Unjudged } from "./text-fit.js"

export type SlideFindings = {
  readonly slide: string
  readonly findings: readonly Finding[]
  readonly unjudged: readonly { readonly node: string; readonly reason: Unjudged | "box" }[]
}

const emuPerPoint = 12_700
const margins = new Set(["sldNum", "dt", "ftr"])

function rectOf(box: Box): Rect {
  return { x: box.x / emuPerPoint, y: box.y / emuPerPoint, w: box.cx / emuPerPoint, h: box.cy / emuPerPoint }
}

function turned(rect: Rect, rotation: number): Rect {
  if (rotation % 360 === 0) return rect
  const angle = (rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  const w = rect.w * cos + rect.h * sin
  const h = rect.w * sin + rect.h * cos
  return { x: rect.x + rect.w / 2 - w / 2, y: rect.y + rect.h / 2 - h / 2, w, h }
}

function written(text: ResolvedText | null): boolean {
  return text !== null && text.paragraphs.some((paragraph) => paragraph.runs.some((run) => run.text !== ""))
}

function largest(text: ResolvedText): number {
  return Math.max(0, ...text.paragraphs.flatMap((paragraph) => paragraph.runs.map((run) => run.size))) * text.fontScale
}

function fittingSize(text: ResolvedText, box: Box, widths: FontWidths, room: number): number | null {
  const top = largest(text)
  const fits = (size: number) => {
    const laid = layText({ ...text, fontScale: (text.fontScale * size) / top }, box, widths)
    return typeof laid !== "string" && laid.height <= room + findingLimits.overflow
  }
  let low = 1
  let high = Math.ceil(top) - 1
  if (high < low || !fits(low)) return null
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (fits(middle)) low = middle
    else high = middle - 1
  }
  return low
}

function overflowOf(slide: string, element: ResolvedElement, laid: TextLayout, widths: FontWidths): Finding | null {
  const { text, box } = element
  if (text === null || box === null || text.fit !== "none") return null
  if (laid.height <= laid.room + findingLimits.overflow) return null
  const insets = (text.insets.top + text.insets.bottom) / emuPerPoint
  return {
    slide,
    node: element.node,
    code: "overflow",
    level: "fault",
    needed: points(laid.height),
    room: points(laid.room),
    fix: { size: fittingSize(text, box, widths, laid.room), height: points(laid.height + insets) },
  }
}

export function elementOverflow(
  slide: string,
  element: ResolvedElement,
  widths: FontWidths,
): Finding | Unjudged | "box" | null {
  if (element.text === null || !written(element.text)) return null
  if (element.box === null) return "box"
  const laid = layText(element.text, element.box, widths)
  return typeof laid === "string" ? laid : overflowOf(slide, element, laid, widths)
}

function pastEdge(rect: Rect, width: number, height: number): number {
  return Math.max(0, -rect.x, rect.x + rect.w - width, -rect.y, rect.y + rect.h - height)
}

function inside(rect: Rect, width: number, height: number): { readonly dx: number; readonly dy: number } | null {
  if (rect.w > width || rect.h > height) return null
  const dx = rect.x < 0 ? -rect.x : Math.min(0, width - rect.x - rect.w)
  const dy = rect.y < 0 ? -rect.y : Math.min(0, height - rect.y - rect.h)
  return { dx, dy }
}

function offSlideOf(slide: ResolvedSlide, place: Placed): Finding | null {
  const { element, box } = place
  if (box === null) return null
  const width = slide.size.width / emuPerPoint
  const height = slide.size.height / emuPerPoint
  const bounds = turned(box, element.rotation)
  const whole = bounds.x >= width || bounds.y >= height || bounds.x + bounds.w <= 0 || bounds.y + bounds.h <= 0
  if (!whole && pastEdge(bounds, width, height) <= findingLimits.offSlide) return null
  const target = whole ? bounds : place.glyphs.length === 0 ? null : union(place.glyphs)
  if (target === null) return null
  const past = pastEdge(target, width, height)
  if (!whole && past <= findingLimits.offSlide) return null
  const shift = inside(bounds, width, height) ?? inside(target, width, height)
  return {
    slide: slide.slide,
    node: element.node,
    code: "off-slide",
    level: whole ? "note" : "fault",
    past: points(past),
    fix: shift === null ? null : { x: points(box.x + shift.dx), y: points(box.y + shift.dy) },
  }
}

function smallTextOf(slide: ResolvedSlide, element: ResolvedElement): Finding | null {
  const { text } = element
  if (text === null || margins.has(element.placeholder ?? "")) return null
  const sizes = text.paragraphs.flatMap((paragraph) =>
    paragraph.runs.filter((run) => run.text.trim() !== "").map((run) => run.size * text.fontScale),
  )
  if (sizes.length === 0) return null
  const limit = (findingLimits.smallText * slide.size.height) / emuPerPoint / findingLimits.slideHeight
  const size = Math.min(...sizes)
  if (size >= limit) return null
  return {
    slide: slide.slide,
    node: element.node,
    code: "small-text",
    level: "fault",
    size: points(size),
    fix: { size: Math.ceil(limit) },
  }
}

function emptyOf(slide: string, element: ResolvedElement): Finding | null {
  const { placeholder } = element
  if (placeholder === null || margins.has(placeholder) || element.kind !== "shape" || written(element.text)) return null
  return { slide, node: element.node, code: "empty-placeholder", level: "note", placeholder, fix: "delete" }
}

export function slideFindings(slide: ResolvedSlide, widths: FontWidths): SlideFindings {
  const findings: Finding[] = []
  const unjudged: { node: string; reason: Unjudged | "box" }[] = []
  const placed: Placed[] = []
  for (const element of slide.elements) {
    const box = element.box === null ? null : rectOf(element.box)
    const mine = element.from === "slide"
    let laid: TextLayout | null = null
    if (mine && element.text !== null && written(element.text)) {
      const result = element.box === null ? "box" : layText(element.text, element.box, widths)
      if (typeof result === "string") unjudged.push({ node: element.node, reason: result })
      else laid = result
    }
    const glyphs =
      laid === null || box === null || element.rotation % 360 !== 0
        ? []
        : laid.lines
            .filter((line) => line.right > line.left && line.glyphBottom > line.glyphTop)
            .map((line) => ({
              x: box.x + line.left,
              y: box.y + line.glyphTop,
              w: line.right - line.left,
              h: line.glyphBottom - line.glyphTop,
            }))
    const place = { element, box, glyphs }
    placed.push(place)
    if (!mine) continue
    const own = [
      laid === null ? null : overflowOf(slide.slide, element, laid, widths),
      offSlideOf(slide, place),
      smallTextOf(slide, element),
      emptyOf(slide.slide, element),
    ]
    for (const finding of own) if (finding !== null) findings.push(finding)
  }
  findings.push(
    ...overlapFindings(slide, placed),
    ...contrastFindings(slide, placed),
    ...alignFindings(slide),
    ...scaleFindings(slide),
  )
  return { slide: slide.slide, findings, unjudged }
}
