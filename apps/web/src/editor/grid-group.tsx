import { defaultGrid1, slideId } from "@airdesign/document"
import type { ReactNode } from "react"
import type { SlideStrip } from "@/editor/slide-sidebar"

export type GridGroup = { readonly start: number; readonly end: number }

export function gridGroups(strip: SlideStrip): readonly GridGroup[] {
  const file = Array.from({ length: strip.count }, (_, index) => slideId(String(index + 1)))
  const starts = strip.groups?.map((group) => group.start) ?? defaultGrid1(file).starts.map((id) => file.indexOf(id))
  return starts.map((start, index) => ({ start, end: starts[index + 1] ?? strip.count }))
}

export function GridGroupCell({
  group,
  index,
  handle,
  children,
}: {
  group: Pick<GridGroup, "start">
  index: number
  handle?: ReactNode
  children: ReactNode
}) {
  const offset = index - group.start
  return (
    <div className="contents">
      {handle}
      <div style={{ gridColumn: offset + 1, gridRow: 1 }}>{children}</div>
    </div>
  )
}
