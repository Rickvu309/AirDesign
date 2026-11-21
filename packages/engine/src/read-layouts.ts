import { layoutId } from "@airdesign/catalog"
import type { IndexLayout } from "@airdesign/document"

export type ReadLayout = {
  readonly id: string
  readonly name: string
  readonly placeholders: readonly string[]
}

export function readLayouts(layouts: readonly IndexLayout[]): readonly ReadLayout[] {
  return layouts.map((layout, at) => ({
    id: layoutId(at),
    name: layout.name,
    placeholders: layout.floor.flatMap((row) => (row.role === undefined ? [] : [row.role])),
  }))
}
