import { deckOf } from "./deck-of.js"
import type { NodeId } from "./ids.js"
import type { Align9, Layout, Sizing } from "./layout.js"
import { boxBetween, lineEnds } from "./line-ends.js"
import type { Measure } from "./measure.js"
import type { Props, PropName } from "./props.js"
import type { Box } from "./resolved.js"
import type { Node, Scene } from "./scene.js"
import type { Theme } from "./theme.js"

type Size = { readonly w: number; readonly h: number }
type Mode = Sizing["w"]
type Context = {
  readonly scene: Scene
  readonly theme: Theme
  readonly measure: Measure
  readonly sizes: Map<string, Size>
}
type Placed = { readonly id: NodeId; readonly box: Box }
type Plan = { readonly size: Size; readonly kids: readonly Placed[] }
type Flow = Extract<Layout, { mode: "row" | "column" }>
type Grid = Extract<Layout, { mode: "grid" }>

const nothing: Box = { x: 0, y: 0, w: 0, h: 0, rotation: 0, flipH: false, flipV: false }
const factor = { top: 0, left: 0, center: 0.5, bottom: 1, right: 1 } as const

const prop = <K extends PropName>(node: Node, key: K): Props[K] | undefined => (node as Partial<Props>)[key]
const storedBox = (node: Node): Box => prop(node, "box") ?? nothing
const layoutOf = (node: Node): Layout => prop(node, "layout") ?? { mode: "none" }
const isLine = (node: Node) => prop(node, "geometry")?.kind === "line"

function modes(node: Node): { readonly w: Mode; readonly h: Mode } {
  const sizing = prop(node, "sizing") ?? { w: "fixed", h: "fixed" }
  const resize = node.type === "shape" ? prop(node, "text")?.resize : undefined
  return {
    w: sizing.w !== "fixed" ? sizing.w : resize === "widthAndHeight" ? "hug" : "fixed",
    h: sizing.h !== "fixed" ? sizing.h : resize === "height" || resize === "widthAndHeight" ? "hug" : "fixed",
  }
}

function childrenOf(context: Context, id: NodeId): readonly Node[] {
  return (context.scene.children.get(id) ?? []).flatMap((child) => {
    const node = context.scene.nodes.get(child)
    return node === undefined || prop(node, "hidden") === true ? [] : [node]
  })
}

function sizeOf(context: Context, node: Node, forcedW: number | null, forcedH: number | null): Size {
  const key = `${node.id}|${String(forcedW)}|${String(forcedH)}`
  const known = context.sizes.get(key)
  if (known !== undefined) return known
  const size = measuredSize(context, node, forcedW, forcedH)
  context.sizes.set(key, size)
  return size
}

function measuredSize(context: Context, node: Node, forcedW: number | null, forcedH: number | null): Size {
  const mode = modes(node)
  const stored = storedBox(node)
  const w = forcedW ?? (mode.w === "fixed" ? stored.w : null)
  const h = forcedH ?? (mode.h === "fixed" ? stored.h : null)
  if (w !== null && h !== null && node.type !== "frame") return { w, h }
  if (node.type === "frame") return plan(context, node, w, h).size
  const text = prop(node, "text")
  if (text === undefined) return { w: w ?? stored.w, h: h ?? stored.h }
  const measured = context.measure(text, context.theme, w)
  return { w: w ?? measured.w, h: h ?? measured.h }
}

function place(node: Node, x: number, y: number, size: Size): Placed {
  return { id: node.id, box: { ...storedBox(node), x, y, w: size.w, h: size.h } }
}

function alignOf(align: Align9, horizontal: boolean): readonly [main: number, cross: number] {
  const [vertical = "top", across = "left"] = align.split("-") as [keyof typeof factor, keyof typeof factor]
  return horizontal ? [factor[across], factor[vertical]] : [factor[vertical], factor[across]]
}

type Item = { readonly node: Node; readonly mode: Mode; readonly crossMode: Mode; readonly main: number }

function flowPlan(context: Context, layout: Flow, flow: readonly Node[], w: number | null, h: number | null): Plan {
  const horizontal = layout.mode === "row"
  const { padding, gap } = layout
  const padMain = horizontal ? padding.l + padding.r : padding.t + padding.b
  const padCross = horizontal ? padding.t + padding.b : padding.l + padding.r
  const outerMain = horizontal ? w : h
  const outerCross = horizontal ? h : w
  const innerCross = outerCross === null ? null : Math.max(0, outerCross - padCross)
  const innerMain = outerMain === null ? null : Math.max(0, outerMain - padMain)
  const [mainShare, crossShare] = alignOf(layout.align, horizontal)
  const along = (size: Size) => (horizontal ? size.w : size.h)
  const across = (size: Size) => (horizontal ? size.h : size.w)
  const items: Item[] = flow.map((node) => {
    const mode = modes(node)
    const crossMode = horizontal ? mode.h : mode.w
    const forced = crossMode === "fill" ? innerCross : null
    return {
      node,
      mode: horizontal ? mode.w : mode.h,
      crossMode,
      main: along(sizeOf(context, node, horizontal ? null : forced, horizontal ? forced : null)),
    }
  })
  const lines: Item[][] = [[]]
  let running = 0
  for (const item of items) {
    const line = lines[lines.length - 1]!
    const next = running + (line.length > 0 ? gap : 0) + item.main
    if (layout.wrap === true && innerMain !== null && line.length > 0 && next > innerMain) {
      lines.push([item])
      running = item.main
    } else {
      line.push(item)
      running = next
    }
  }
  const sized = lines.map((line) => {
    const fills = line.filter((item) => item.mode === "fill")
    const used = line.reduce((sum, item) => sum + (item.mode === "fill" ? 0 : item.main), 0) + gap * (line.length - 1)
    const share = innerMain === null || fills.length === 0 ? null : Math.max(0, innerMain - used) / fills.length
    return line.map((item) => {
      const main = item.mode === "fill" && share !== null ? share : item.main
      const natural = sizeOf(context, item.node, horizontal ? main : null, horizontal ? null : main)
      return { item, main, cross: across(natural) }
    })
  })
  const lineCross = sized.map((line) => line.reduce((most, entry) => Math.max(most, entry.cross), 0))
  const crossTotal = lineCross.reduce((sum, size) => sum + size, 0) + gap * (lines.length - 1)
  const finalCross = outerCross ?? crossTotal + padCross
  const spaceCross = lines.length === 1 ? finalCross - padCross : null
  const kids: Placed[] = []
  const mains: number[] = []
  let crossAt = horizontal ? padding.t : padding.l
  for (const [index, line] of sized.entries()) {
    const used = line.reduce((sum, entry) => sum + entry.main, 0) + gap * (line.length - 1)
    mains.push(used)
    const room = (spaceCross ?? lineCross[index]!) as number
    let mainAt =
      (horizontal ? padding.l : padding.t) + (innerMain === null ? 0 : mainShare * Math.max(0, innerMain - used))
    for (const { item, main, cross } of line) {
      const filled = item.crossMode === "fill"
      const final = filled
        ? sizeOf(context, item.node, horizontal ? main : room, horizontal ? room : main)
        : sizeOf(context, item.node, horizontal ? main : cross, horizontal ? cross : main)
      const crossOffset = crossShare * Math.max(0, room - across(final))
      kids.push(
        horizontal
          ? place(item.node, mainAt, crossAt + crossOffset, final)
          : place(item.node, crossAt + crossOffset, mainAt, final),
      )
      mainAt += main + gap
    }
    crossAt += lineCross[index]! + gap
  }
  const mainTotal = Math.max(0, ...mains) + padMain
  return {
    size: horizontal ? { w: outerMain ?? mainTotal, h: finalCross } : { w: finalCross, h: outerMain ?? mainTotal },
    kids,
  }
}

type Cell = {
  readonly node: Node
  readonly row: number
  readonly col: number
  readonly rows: number
  readonly cols: number
}

function cellsOf(grid: Grid, flow: readonly Node[]): readonly Cell[] {
  const taken = new Set<string>()
  const cover = (row: number, col: number, rows: number, cols: number) => {
    for (let r = row; r < row + rows; r += 1)
      for (let c = col; c < col + cols; c += 1) taken.add(`${String(r)}:${String(c)}`)
  }
  for (const node of flow) {
    const cell = prop(node, "cell")
    if (cell !== undefined) cover(cell.row, cell.col, cell.rowSpan ?? 1, cell.colSpan ?? 1)
  }
  let next = 0
  return flow.map((node) => {
    const cell = prop(node, "cell")
    if (cell !== undefined)
      return { node, row: cell.row, col: cell.col, rows: cell.rowSpan ?? 1, cols: cell.colSpan ?? 1 }
    const width = grid.columns.length
    while (taken.has(`${String(Math.floor(next / width))}:${String(next % width)}`)) next += 1
    const row = Math.floor(next / width)
    const col = next % width
    cover(row, col, 1, 1)
    return { node, row, col, rows: 1, cols: 1 }
  })
}

function tracksOf(
  tracks: Grid["columns"],
  space: number | null,
  gap: number,
  content: (index: number) => number,
): readonly number[] {
  const fixed = tracks.map((track, index) => (track === "hug" ? content(index) : "px" in track ? track.px : null))
  const frs = tracks.reduce((sum, track) => sum + (track !== "hug" && "fr" in track ? track.fr : 0), 0)
  const used = fixed.reduce<number>((sum, size) => sum + (size ?? 0), 0) + gap * (tracks.length - 1)
  const left = space === null ? 0 : Math.max(0, space - used)
  return tracks.map((track, index) => {
    const size = fixed[index]
    if (size !== null && size !== undefined) return size
    if (space === null || frs === 0) return content(index)
    return (left * (track as { fr: number }).fr) / frs
  })
}

const spanOf = (sizes: readonly number[], from: number, count: number, gap: number): number => {
  let total = gap * (count - 1)
  for (let at = from; at < from + count; at += 1) total += sizes[at] ?? 0
  return total
}

const offsetOf = (sizes: readonly number[], to: number, gap: number): number => {
  let total = 0
  for (let at = 0; at < to; at += 1) total += (sizes[at] ?? 0) + gap
  return total
}

function gridPlan(context: Context, layout: Grid, flow: readonly Node[], w: number | null, h: number | null): Plan {
  const { padding, gap } = layout
  const cells = cellsOf(layout, flow)
  const rowCount = Math.max(layout.rows.length, ...cells.map((cell) => cell.row + cell.rows))
  const rowTracks = [...layout.rows, ...Array.from({ length: rowCount - layout.rows.length }, () => "hug" as const)]
  const innerW = w === null ? null : Math.max(0, w - padding.l - padding.r)
  const innerH = h === null ? null : Math.max(0, h - padding.t - padding.b)
  const natural = new Map(cells.map((cell) => [cell.node.id, sizeOf(context, cell.node, null, null)] as const))
  const columns = tracksOf(layout.columns, innerW, gap, (index) =>
    Math.max(
      0,
      ...cells.filter((cell) => cell.col === index && cell.cols === 1).map((cell) => natural.get(cell.node.id)!.w),
    ),
  )
  const rows = tracksOf(rowTracks, innerH, gap, (index) =>
    Math.max(
      0,
      ...cells
        .filter((cell) => cell.row === index && cell.rows === 1)
        .map((cell) => {
          const fillW = modes(cell.node).w === "fill"
          return sizeOf(context, cell.node, fillW ? spanOf(columns, cell.col, cell.cols, gap) : null, null).h
        }),
    ),
  )
  const kids = cells.map((cell) => {
    const mode = modes(cell.node)
    const width = spanOf(columns, cell.col, cell.cols, gap)
    const height = spanOf(rows, cell.row, cell.rows, gap)
    const size = sizeOf(context, cell.node, mode.w === "fill" ? width : null, mode.h === "fill" ? height : null)
    return place(
      cell.node,
      padding.l + offsetOf(columns, cell.col, gap),
      padding.t + offsetOf(rows, cell.row, gap),
      size,
    )
  })
  return {
    size: {
      w: w ?? spanOf(columns, 0, columns.length, gap) + padding.l + padding.r,
      h: h ?? spanOf(rows, 0, rows.length, gap) + padding.t + padding.b,
    },
    kids,
  }
}

function plan(context: Context, container: Node, w: number | null, h: number | null): Plan {
  const layout = layoutOf(container)
  const children = childrenOf(context, container.id).filter((child) => !isLine(child))
  const flowing = layout.mode === "none" ? [] : children.filter((child) => prop(child, "absolute") !== true)
  const loose = children.filter((child) => !flowing.includes(child))
  const freed = loose.map((child) => {
    const stored = storedBox(child)
    return place(child, stored.x, stored.y, sizeOf(context, child, null, null))
  })
  const arranged =
    layout.mode === "none"
      ? { size: { w: 0, h: 0 }, kids: [] as readonly Placed[] }
      : layout.mode === "grid"
        ? gridPlan(context, layout, flowing, w, h)
        : flowPlan(context, layout, flowing, w, h)
  const extent = (pick: (box: Box) => number) => Math.max(0, ...freed.map(({ box }) => pick(box)))
  const own =
    layout.mode === "none"
      ? { w: w ?? extent((box) => box.x + box.w), h: h ?? extent((box) => box.y + box.h) }
      : arranged.size
  return { size: own, kids: [...arranged.kids, ...freed] }
}

function arrange(context: Context, boxes: Map<NodeId, Box>, node: Node, w: number, h: number): void {
  for (const kid of plan(context, node, w, h).kids) {
    boxes.set(kid.id, kid.box)
    const child = context.scene.nodes.get(kid.id)
    if (child?.type === "frame") arrange(context, boxes, child, kid.box.w, kid.box.h)
  }
}

function lines(context: Context, boxes: Map<NodeId, Box>, id: NodeId): void {
  for (const child of childrenOf(context, id)) {
    if (isLine(child)) {
      const geometry = prop(child, "geometry")
      if (geometry?.kind === "line") {
        const { from, to } = lineEnds(context.scene, boxes, id, geometry)
        boxes.set(child.id, boxBetween(from, to))
      }
    } else lines(context, boxes, child.id)
  }
}

export function solveLayout(scene: Scene, root: NodeId, measure: Measure): ReadonlyMap<NodeId, Box> {
  const node = scene.nodes.get(root)
  const boxes = new Map<NodeId, Box>()
  if (node === undefined) return boxes
  const { theme, size } = deckOf(scene)
  const context = { scene, theme, measure, sizes: new Map<string, Size>() }
  if (node.type === "slide") {
    boxes.set(root, { ...nothing, w: size.w, h: size.h })
    arrange(context, boxes, node, size.w, size.h)
  } else {
    const own = sizeOf(context, node, null, null)
    boxes.set(root, { ...storedBox(node), w: own.w, h: own.h })
    arrange(context, boxes, node, own.w, own.h)
  }
  lines(context, boxes, root)
  return boxes
}
