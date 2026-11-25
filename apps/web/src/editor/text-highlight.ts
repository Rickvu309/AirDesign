export type Highlight = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

type Point = { readonly x: number; readonly y: number }
type Span = { readonly from: number; readonly to: number }
type Frame = { readonly local: (point: Point) => Point; readonly scale: number; readonly turn: number }

export const probeSpan = 100

const middle = (rect: DOMRect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })

function frameOf(layer: HTMLElement): Frame | null {
  const [origin, across, down] = [...layer.querySelectorAll("[data-text-probe]")].map((probe) =>
    middle(probe.getBoundingClientRect()),
  )
  if (origin === undefined || across === undefined || down === undefined) return null
  const along = (point: Point, end: Point) => {
    const [dx, dy] = [end.x - origin.x, end.y - origin.y]
    const length = dx * dx + dy * dy
    return length === 0 ? 0 : (((point.x - origin.x) * dx + (point.y - origin.y) * dy) / length) * probeSpan
  }
  const [dx, dy] = [across.x - origin.x, across.y - origin.y]
  const scale = Math.hypot(dx, dy) / probeSpan
  return scale === 0
    ? null
    : { local: (point) => ({ x: along(point, across), y: along(point, down) }), scale, turn: Math.atan2(dy, dx) }
}

function place(line: HTMLElement, local: number, side: "start" | "end"): { node: Node; at: number } | null {
  const runs = [...line.querySelectorAll<HTMLElement>("[data-run]")]
  let left = local
  for (const [at, run] of runs.entries()) {
    const length = run.textContent?.length ?? 0
    const inside = side === "end" || at === runs.length - 1 ? left <= length : left < length
    if (inside) return run.firstChild === null ? null : { node: run.firstChild, at: left }
    left -= length
  }
  return null
}

function joined(spans: readonly Span[]): readonly Span[] {
  return spans
    .toSorted((a, b) => a.from - b.from)
    .reduce<Span[]>((kept, each) => {
      const before = kept.at(-1)
      if (before === undefined || each.from > before.to + 0.5) return [...kept, each]
      return [...kept.slice(0, -1), { from: before.from, to: Math.max(before.to, each.to) }]
    }, [])
}

function spansOf(line: HTMLElement, from: number, to: number, frame: Frame): readonly Span[] {
  const [first, last] = [place(line, from, "start"), place(line, to, "end")]
  if (first === null || last === null) return []
  const range = line.ownerDocument.createRange()
  range.setStart(first.node, first.at)
  range.setEnd(last.node, last.at)
  const [cos, sin] = [Math.abs(Math.cos(frame.turn)), Math.abs(Math.sin(frame.turn))]
  const high = line.querySelector<HTMLElement>("[data-run]")?.offsetHeight ?? line.offsetHeight
  const spans = [...range.getClientRects()].map((rect) => {
    const wide =
      cos >= sin ? (rect.width / frame.scale - high * sin) / cos : (rect.height / frame.scale - high * cos) / sin
    const centre = frame.local(middle(rect)).x
    return { from: centre - Math.max(0, wide) / 2, to: centre + Math.max(0, wide) / 2 }
  })
  return joined(spans)
}

export function highlightsOf(
  host: HTMLElement,
  layer: HTMLElement,
  anchor: number,
  focus: number,
): readonly Highlight[] {
  const [low, high] = [Math.min(anchor, focus), Math.max(anchor, focus)]
  const frame = low === high ? null : frameOf(layer)
  if (frame === null) return []
  const lines = [...host.querySelectorAll<HTMLElement>("[data-line]")]
  return lines.flatMap((line, at) => {
    const [start, end] = [Number(line.dataset.start), Number(line.dataset.end)]
    const next = lines[at + 1]
    const broken = high > end && next !== undefined && Number(next.dataset.start) > end
    const [from, to] = [Math.max(low, start), Math.min(high, end)]
    if (from > to || (from === to && !broken)) return []
    const [h, centre] = [line.offsetHeight, frame.local(middle(line.getBoundingClientRect()))]
    const spans = from === to ? [] : spansOf(line, from - start, to - start, frame)
    const backward = getComputedStyle(line).direction === "rtl"
    const edge = backward
      ? (spans[0]?.from ?? centre.x + line.offsetWidth / 2)
      : (spans.at(-1)?.to ?? centre.x - line.offsetWidth / 2)
    const tail = broken ? [backward ? { from: edge - h / 4, to: edge } : { from: edge, to: edge + h / 4 }] : []
    return joined([...spans, ...tail]).map((each) => ({ x: each.from, y: centre.y - h / 2, w: each.to - each.from, h }))
  })
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.01

export const sameHighlights = (a: readonly Highlight[], b: readonly Highlight[]) =>
  a.length === b.length &&
  a.every((each, at) => {
    const other = b[at]!
    return near(each.x, other.x) && near(each.y, other.y) && near(each.w, other.w) && near(each.h, other.h)
  })
