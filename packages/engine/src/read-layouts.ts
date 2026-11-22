import { layoutId, pointBox } from "@airdesign/catalog"
import type { IndexLayout } from "@airdesign/document"

export type ReadLayout = {
  readonly id: string
  readonly name: string
  readonly placeholders: readonly { readonly role: string; readonly box?: ReturnType<typeof pointBox> }[]
}

export function readLayouts(layouts: readonly IndexLayout[]): readonly ReadLayout[] {
  return layouts.map((layout, at) => ({
    id: layoutId(at),
    name: layout.name,
    placeholders: layout.floor.flatMap((row) => {
      if (row.role === undefined) return []
      const box = row.box ?? row.placed
      return [{ role: row.role, ...(box === undefined ? {} : { box: pointBox(box) }) }]
    }),
  }))
}
