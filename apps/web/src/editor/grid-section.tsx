import { defaultGrid1, slideId } from "@airdesign/document"
import type { ReactNode } from "react"
import type { SlideStrip } from "@/editor/slide-sidebar"

export type GridRow = {
  readonly name: string | null
  readonly number: number | null
  readonly start: number
  readonly end: number
}

export function gridRows(strip: SlideStrip): readonly GridRow[] {
  const file = Array.from({ length: strip.count }, (_, index) => slideId(String(index + 1)))
  const starts = strip.gridStarts ?? defaultGrid1(file).starts.map((id) => file.indexOf(id))
  return starts.map((start, index) => ({
    name: null,
    number: null,
    start,
    end: starts[index + 1] ?? strip.count,
  }))
}

export function GridSectionCell({
  row,
  index,
  handle,
  children,
}: {
  row: Pick<GridRow, "start">
  index: number
  handle?: ReactNode
  children: ReactNode
}) {
  const offset = index - row.start
  return (
    <div className="contents">
      {handle}
      <div style={{ gridColumn: offset + 1, gridRow: 1 }}>{children}</div>
    </div>
  )
}
