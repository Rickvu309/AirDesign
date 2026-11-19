import type { PaintElement, PaintTie } from "@airdesign/pptx"
import type { CanvasElement } from "@airdesign/render"
import { paintFrame } from "@/canvas-frame"
import { groupsOf, paintGroup, withHeld } from "@/canvas-group"
import { paintPicture } from "@/canvas-picture"
import { paintPreset } from "@/preset-paint"
import type { CanvasSource } from "@/canvas-source"
import { paintTable } from "@/canvas-table"
import { paintTextBox } from "@/text-box-paint"
import type { PictureSource } from "@/picture-fill"

const textPreset = new Set(["rect", "roundRect", "ellipse"])

const painters = {
  text: paintTextBox,
  picture: paintPicture,
  shape: paintPreset,
  table: paintTable,
  frame: paintFrame,
}

type PaintKind = keyof typeof painters | "group"

export function paintKindOf(row: PaintElement): PaintKind {
  if (row.kind === "p:grpSp") return "group"
  if (row.table !== undefined) return "table"
  if (row.kind === "p:graphicFrame") return "frame"
  if (row.kind === "p:pic") return "picture"
  if (row.kind === "p:cxnSp") return "shape"
  if (row.geometry !== null && !textPreset.has(row.geometry)) return "shape"
  return "text"
}

function lockedShapes(rows: readonly PaintElement[]): ReadonlySet<string> {
  const above = new Map<string, string | null>()
  for (const row of rows) if (row.from === "slide") above.set(row.shape, row.group)
  const own = new Set(rows.flatMap((row) => (row.from === "slide" && row.locked === true ? [row.shape] : [])))
  const locked = new Set<string>()
  for (const shape of above.keys()) {
    const seen = new Set<string>()
    for (let at: string | null = shape; at !== null && !seen.has(at); at = above.get(at) ?? null) {
      seen.add(at)
      if (own.has(at)) locked.add(shape)
    }
  }
  return locked
}

export function paintElements(
  rows: readonly PaintElement[],
  source: CanvasSource,
  src: PictureSource,
): readonly CanvasElement[] {
  const seen = new Map<string, number>()
  const elements: (readonly [CanvasElement, PaintElement])[] = []
  const tops = groupsOf(rows, source)
  const locked = lockedShapes(rows)
  for (const row of rows) {
    const kind = paintKindOf(row)
    const name = `${row.part}#${row.shape}`
    const count = seen.get(name) ?? 0
    seen.set(name, count + 1)
    const key = count === 0 ? name : `${name}#${count}`
    const group = row.from === "slide" ? tops.get(row.shape) : undefined
    const carried = group === undefined ? {} : { group }
    const lock = row.from === "slide" && locked.has(row.shape) ? ({ locked: true, movable: false } as const) : {}
    if (kind === "group") {
      const painted = paintGroup(row, source, key)
      if (painted !== null) elements.push([{ ...painted, ...carried, ...lock }, row])
      continue
    }
    const shape = row.from === "slide" ? source.shapes.get(row.shape) : undefined
    const painted = painters[kind]({ row, shape, key, src })
    if (painted === null) continue
    const diagram = row.diagram === undefined ? {} : { diagram: diagramOf(row.diagram, key, src) }
    const backdrop = shape?.backdrop === true ? { backdrop: true as const } : {}
    const inFrame =
      shape?.inFrame === undefined
        ? {}
        : { inFrame: shape.inFrame, ...(shape.measure === undefined ? {} : { measure: shape.measure }) }
    elements.push([
      { ...painted, ...diagram, ...carried, ...backdrop, ...inFrame, ...connectionOf(row, source), ...lock },
      row,
    ])
  }
  return withHeld(elements, rows)
}

function tieOf(tie: PaintTie | null, source: CanvasSource) {
  const node = tie === null ? undefined : source.shapes.get(tie.shape)?.id
  return node === undefined || tie === null ? null : { node, site: tie.site }
}

function connectionOf(row: PaintElement, source: CanvasSource): Pick<CanvasElement, "connection"> {
  if (row.connection === undefined || row.from !== "slide") return {}
  const start = tieOf(row.connection.start, source)
  const end = tieOf(row.connection.end, source)
  return start === null && end === null ? {} : { connection: { start, end } }
}

function diagramOf(rows: readonly PaintElement[], key: string, src: PictureSource): readonly CanvasElement[] {
  return rows.flatMap((row) => {
    const kind = paintKindOf(row)
    return kind === "group" ? [] : [painters[kind]({ row, shape: undefined, key: `${key}/${row.shape}`, src })]
  })
}
