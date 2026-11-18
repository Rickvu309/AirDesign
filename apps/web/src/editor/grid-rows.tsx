import type { SlideId } from "@airdesign/document"
import { useState, type PointerEvent, type ReactNode } from "react"
import { gridIndices } from "@/editor/grid-drop"
import { GridRowAdd } from "@/editor/grid-row-add"
import { GridRowFrame } from "@/editor/grid-row-frame"
import { GridSectionCell, type GridRow } from "@/editor/grid-section"
import { gridRowHandle, gridSectionHeight, gridSpacing } from "@/editor/grid-viewport"
import type { StripSection } from "@/editor/slide-sidebar"

export function GridRows({
  rows,
  sections,
  ids,
  columns,
  width,
  height,
  scale,
  collapsed,
  shown,
  renderCard,
  addBlocked,
  rowBlocked,
  onGrab,
  onMove,
  onAdd,
}: {
  rows: readonly GridRow[]
  sections: readonly StripSection[]
  ids: readonly SlideId[] | undefined
  columns: number
  width: number
  height: number
  scale: number
  collapsed: { held: ReadonlySet<number>; toggle: (number: number) => void }
  shown: (index: number) => boolean
  renderCard: (index: number) => ReactNode
  addBlocked: boolean
  rowBlocked: boolean
  onGrab: (index: number, event: PointerEvent<HTMLButtonElement>) => void
  onMove: (row: number, direction: "earlier" | "later") => void
  onAdd: (index: number) => void
}) {
  const [hover, setHover] = useState<{ row: number; part: "band" | "slide" | "add" } | null>(null)
  const [focus, setFocus] = useState<{ row: number; part: "handle" | "add" } | null>(null)
  const spacing = gridSpacing(width, height)
  const count = rows.at(-1)?.end ?? 0
  const columnsOf = (length: number) => `repeat(${length}, ${width}px)`
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: columnsOf(columns), columnGap: spacing.column, rowGap: spacing.row }}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse" || rowBlocked || !(event.target instanceof Element)) return
        const member = event.target.closest<HTMLElement>("[data-grid-row], [data-grid-row-member]")
        const row = Number(member?.dataset.gridRow ?? member?.dataset.gridRowMember)
        if (!Number.isFinite(row)) {
          if (hover !== null) setHover(null)
          return
        }
        const part =
          event.target.closest("[data-row-insert]") !== null
            ? "add"
            : event.target.closest("[data-slide-entry], [data-slide-number], [data-grid-edit]") !== null
              ? "slide"
              : "band"
        if (hover?.row !== row || hover.part !== part) setHover({ row, part })
      }}
      onPointerLeave={() => setHover(null)}
      onPointerDown={(event) => {
        if (event.pointerType === "touch") setHover(null)
      }}
      onFocus={(event) => {
        if (!event.target.matches(":focus-visible")) return
        const member = event.target.closest<HTMLElement>("[data-grid-row], [data-grid-row-member]")
        if (member === null) return
        const row = Number(member.dataset.gridRow ?? member.dataset.gridRowMember)
        if (event.target.matches("[data-row-handle]")) setFocus({ row, part: "handle" })
        else if (event.target.matches("[data-add-row]")) setFocus({ row, part: "add" })
      }}
      onBlur={() => {
        if (focus !== null) setFocus(null)
      }}
    >
      {rows.flatMap((row, number) => {
        const indices = gridIndices(row)
        const key = ids?.[row.start] ?? row.start
        const place = { gridRow: number + 1, gridColumn: `1 / span ${indices.length}` }
        const heads = sections.some((section) => section.start >= row.start && section.start < row.end)
        const headingGap = 24 / scale
        const rowHeight = height + 24 + (heads ? gridSectionHeight / scale : 0)
        const rowHover = hover?.row === row.start ? hover.part : null
        const rowFocus = focus?.row === row.start ? focus.part : null
        const tinted =
          !rowBlocked &&
          height * scale >= gridRowHandle.minimumHeight &&
          (rowHover === "band" || rowFocus === "handle") &&
          rowHover !== "slide"
        return [
          <GridRowFrame
            key={`row:${key}`}
            number={number + 1}
            start={row.start}
            height={height}
            scale={scale}
            blocked={rowBlocked}
            hover={rowFocus === "add" ? "add" : rowHover}
            style={{ ...place, height: rowHeight }}
            onGrab={(event) => onGrab(row.start, event)}
            onMove={(direction) => {
              setHover(null)
              onMove(number, direction)
            }}
          />,
          ...indices.map((index) => (
            <div
              key={ids?.[index] ?? index}
              data-grid-row-member={row.start}
              data-row-tint={tinted ? "" : undefined}
              className="pointer-events-none relative grid [&>div>div]:pointer-events-auto"
              style={{
                ...place,
                gridTemplateColumns: columnsOf(indices.length),
                gridTemplateRows: heads ? `${gridSectionHeight / scale - headingGap}px 1fr` : undefined,
                columnGap: spacing.column,
                rowGap: headingGap,
              }}
            >
              <GridSectionCell
                row={row}
                index={index}
                sections={sections}
                count={count}
                scale={scale}
                pitch={width + spacing.column}
                held={collapsed.held}
                onToggle={collapsed.toggle}
                shown={shown(index)}
                height={height}
              >
                {renderCard(index)}
              </GridSectionCell>
            </div>
          )),
          ...(addBlocked
            ? []
            : [
                <div
                  key={`add:${key}`}
                  data-grid-row-member={row.start}
                  className="pointer-events-none relative [&>[data-row-insert]]:pointer-events-auto"
                  style={place}
                >
                  <GridRowAdd
                    row={number + 1}
                    width={width}
                    height={height}
                    gap={spacing.row}
                    scale={scale}
                    last={number === rows.length - 1}
                    onAdd={() => onAdd(row.start)}
                  />
                </div>,
              ]),
        ]
      })}
    </div>
  )
}
