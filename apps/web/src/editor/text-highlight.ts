export type Highlight = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

type Point = { readonly x: number; readonly y: number }

function caretAt(node: Node, at: number): Point | null {
  const range = node.ownerDocument?.createRange()
  if (range === undefined) return null
  range.setStart(node, at)
  range.collapse(true)
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect()
  return rect.width === 0 && rect.height === 0 && rect.x === 0 && rect.y === 0
    ? null
    : { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

const apart = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

function advance(run: HTMLElement, at: number): number {
  const node = run.firstChild
  const length = run.textContent?.length ?? 0
  if (node === null || length === 0 || at <= 0) return 0
  if (at >= length) return run.offsetWidth
  const [start, end, here] = [caretAt(node, 0), caretAt(node, length), caretAt(node, at)]
  if (start === null || end === null || here === null) return 0
  const whole = apart(start, end)
  return whole === 0 ? 0 : (apart(start, here) / whole) * run.offsetWidth
}

function edge(line: HTMLElement, local: number): number {
  const runs = [...line.querySelectorAll<HTMLElement>("[data-run]")]
  let left = local
  for (const run of runs) {
    const length = run.textContent?.length ?? 0
    const forward = getComputedStyle(run).direction !== "rtl"
    if (left <= length) return run.offsetLeft + (forward ? advance(run, left) : run.offsetWidth - advance(run, left))
    left -= length
  }
  const last = runs.at(-1)
  return last === undefined ? 0 : last.offsetLeft + last.offsetWidth
}

export function highlightsOf(host: HTMLElement, anchor: number, focus: number): readonly Highlight[] {
  const [low, high] = [Math.min(anchor, focus), Math.max(anchor, focus)]
  if (low === high) return []
  return [...host.querySelectorAll<HTMLElement>("[data-line]")].flatMap((line) => {
    const [start, end] = [Number(line.dataset.start), Number(line.dataset.end)]
    const [from, to] = [Math.max(low, start), Math.min(high, end)]
    if (from > to || (from === to && !(start === end && low <= start && high > end))) return []
    const [a, b] = [edge(line, from - start), edge(line, to - start)]
    const tail = high > end ? line.offsetHeight / 4 : 0
    const [left, right] = [Math.min(a, b), Math.max(a, b) + (a <= b ? tail : 0)]
    return [{ x: line.offsetLeft + left, y: line.offsetTop, w: right - left, h: line.offsetHeight }]
  })
}

export const sameHighlights = (a: readonly Highlight[], b: readonly Highlight[]) =>
  a.length === b.length &&
  a.every((each, at) => each.x === b[at]!.x && each.y === b[at]!.y && each.w === b[at]!.w && each.h === b[at]!.h)
