import type { Kind } from "@airdesign/document"
import type { PaintElement } from "@airdesign/pptx"
import type { CanvasElement, GroupOf } from "@airdesign/render"
import type { CanvasSource } from "@/canvas-source"

export function isGroupKind(kind: Kind): boolean {
  return kind === "group"
}

export function paintGroup(row: PaintElement, source: CanvasSource, key: string): CanvasElement | null {
  const shape = row.from === "slide" ? source.shapes.get(row.shape) : undefined
  if (shape === undefined || row.box === null) return null
  return {
    key,
    id: shape.id,
    kind: "group",
    box: row.box,
    editable: false,
    movable: shape.movable && row.group === null,
    placeholder: false,
    filled: false,
    fill: null,
    line: null,
    outline: "box",
    text: null,
  }
}

export function groupsOf(rows: readonly PaintElement[], source: CanvasSource): ReadonlyMap<string, GroupOf> {
  const above = new Map<string, string | null>()
  const boxes = new Map<string, PaintElement["box"]>()
  for (const row of rows) {
    if (row.from !== "slide") continue
    above.set(row.shape, row.group)
    if (row.kind === "p:grpSp") boxes.set(row.shape, row.box)
  }
  const tops = new Map<string, GroupOf>()
  for (const row of rows) {
    if (row.from !== "slide" || row.group === null) continue
    let top = row.group
    for (let next = above.get(top) ?? null; next !== null; next = above.get(top) ?? null) top = next
    const id = source.shapes.get(top)?.id
    if (id !== undefined) tops.set(row.shape, { id, box: boxes.get(top) ?? null })
  }
  return tops
}
