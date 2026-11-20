import type { Design, ElementPatch, FieldValue } from "@airdesign/document"

const emuPerPoint = 12_700
const defaultRounding = 16_667

function tenths(value: number): number {
  return Math.round(value * 10) / 10
}

export type Size = { readonly cx: number; readonly cy: number }

function cornersShown(shape: FieldValue<"geometry", "shape">, box: Size | undefined): number | null {
  if (shape.preset !== "roundRect" || box === undefined) return null
  const points = tenths(((shape.adjust.adj ?? defaultRounding) * Math.min(box.cx, box.cy)) / 100_000 / emuPerPoint)
  return points === 0 ? null : points
}

export const cornersAgents = { "geometry.corners": (value: number) => tenths(value / emuPerPoint) } as const

export function foldCorners(design: Design, patch: ElementPatch, box: Size | undefined): Design {
  const edit = patch.geometry?.shape
  if (edit === undefined || edit === "opening") return design
  const rest: Design = Object.fromEntries(Object.entries(design).filter(([key]) => key !== "geometry.corners"))
  const value = edit === "inherit" ? null : cornersShown(edit.set, box)
  return value === null ? rest : { ...rest, "geometry.corners": [value] }
}
