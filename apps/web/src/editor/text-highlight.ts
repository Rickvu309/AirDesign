export type Highlight = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

type Point = { readonly x: number; readonly y: number }

export const probeSpan = 100

const middle = (rect: DOMRect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })

function caretAt(node: Node, at: number): Point | null {
  const range = node.ownerDocument?.createRange()
  if (range === undefined) return null
  range.setStart(node, at)
  range.collapse(true)
  const rect = range.getClientRects()[0]
  return rect === undefined ? null : middle(rect)
}

function localOf(layer: HTMLElement): ((point: Point) => Point) | null {
  const [origin, across, down] = [...layer.querySelectorAll("[data-text-probe]")].map((probe) =>
    middle(probe.getBoundingClientRect()),
  )
  if (origin === undefined || across === undefined || down === undefined) return null
  const along = (point: Point, end: Point) => {
    const [dx, dy] = [end.x - origin.x, end.y - origin.y]
    const length = dx * dx + dy * dy
    return length === 0 ? 0 : (((point.x - origin.x) * dx + (point.y - origin.y) * dy) / length) * probeSpan
  }
  return (point) => ({ x: along(point, across), y: along(point, down) })
}

function caretOf(line: HTMLElement, local: number, side: "start" | "end"): Point | null {
  const runs = [...line.querySelectorAll<HTMLElement>("[data-run]")]
  let left = local
  for (const [at, run] of runs.entries()) {
    const length = run.textContent?.length ?? 0
    const inside = side === "end" || at === runs.length - 1 ? left <= length : left < length
    if (inside) return run.firstChild === null ? null : caretAt(run.firstChild, left)
    left -= length
  }
  return null
}

export function highlightsOf(
  host: HTMLElement,
  layer: HTMLElement,
  anchor: number,
  focus: number,
): readonly Highlight[] {
  const [low, high] = [Math.min(anchor, focus), Math.max(anchor, focus)]
  const local = low === high ? null : localOf(layer)
  if (local === null) return []
  const lines = [...host.querySelectorAll<HTMLElement>("[data-line]")]
  return lines.flatMap((line, at) => {
    const [start, end] = [Number(line.dataset.start), Number(line.dataset.end)]
    const next = lines[at + 1]
    const broken = high > end && next !== undefined && Number(next.dataset.start) > end
    const [from, to] = [Math.max(low, start), Math.min(high, end)]
    if (from > to || (from === to && !broken)) return []
    const [h, centre] = [line.offsetHeight, local(middle(line.getBoundingClientRect()))]
    const blank = centre.x - line.offsetWidth / 2
    const [a, b] = [caretOf(line, from - start, "start"), caretOf(line, to - start, "end")].map((caret) =>
      caret === null ? blank : local(caret).x,
    ) as [number, number]
    const tail = broken ? h / 4 : 0
    const backward = getComputedStyle(line).direction === "rtl"
    const [left, right] = [Math.min(a, b) - (backward ? tail : 0), Math.max(a, b) + (backward ? 0 : tail)]
    return [{ x: left, y: centre.y - h / 2, w: right - left, h }]
  })
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.01

export const sameHighlights = (a: readonly Highlight[], b: readonly Highlight[]) =>
  a.length === b.length &&
  a.every((each, at) => {
    const other = b[at]!
    return near(each.x, other.x) && near(each.y, other.y) && near(each.w, other.w) && near(each.h, other.h)
  })
