import type { PaintElement } from "@airdesign/pptx"
import type { CanvasElement } from "@airdesign/render"
import { paintFrame } from "@/canvas-frame"
import { paintGroup } from "@/canvas-group"
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
  group: paintGroup,
}

type PaintKind = keyof typeof painters

export function paintKindOf(row: PaintElement): PaintKind {
  if (row.kind === "p:grpSp") return "group"
  if (row.table !== undefined) return "table"
  if (row.kind === "p:graphicFrame") return "frame"
  if (row.kind === "p:pic") return "picture"
  if (row.kind === "p:cxnSp") return "shape"
  if (row.geometry !== null && !textPreset.has(row.geometry)) return "shape"
  return "text"
}

export function paintElements(
  rows: readonly PaintElement[],
  source: CanvasSource,
  src: PictureSource,
): readonly CanvasElement[] {
  const seen = new Map<string, number>()
  const elements: CanvasElement[] = []
  for (const row of rows) {
    const kind = paintKindOf(row)
    if (kind === "group") {
      painters.group()
      continue
    }
    const name = `${row.part}#${row.shape}`
    const count = seen.get(name) ?? 0
    seen.set(name, count + 1)
    const shape = row.from === "slide" ? source.shapes.get(row.shape) : undefined
    const painted = painters[kind]({ row, shape, key: count === 0 ? name : `${name}#${count}`, src })
    if (painted !== null) elements.push(painted)
  }
  return elements
}
