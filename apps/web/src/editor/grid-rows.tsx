import type { SlideId } from "@airdesign/document"
import { useState, type PointerEvent, type ReactNode } from "react"
import { GridRowAdd } from "@/editor/grid-row-add"
import { GridRowFrame } from "@/editor/grid-row-frame"
import { GridSectionCell } from "@/editor/grid-section"
import {
  gridHeadingHeight,
  gridRowHandle,
  gridSectionHeight,
  gridSpacing,
  gridTrackColumns,
  gridTracks,
  gridTrackSize,
  type GridGeometry,
} from "@/editor/grid-viewport"
import type { StripSection } from "@/editor/slide-sidebar"

export function GridRows({
  geometry,
  tracks,
  sections,
  ids,
  columns,
  scale,
  collapsed,
  renderCard,
  addBlocked,
  rowBlocked,
  onGrab,
  onMove,
  onAdd,
}: {
  geometry: GridGeometry
  tracks: ReturnType<typeof gridTracks>
  sections: readonly StripSection[]
  ids: readonly SlideId[] | undefined
  columns: number
  scale: number
  collapsed: { held: ReadonlySet<number>; toggle: (number: number) => void }
  renderCard: (index: number) => ReactNode
  addBlocked: boolean
  rowBlocked: boolean
  onGrab: (index: number, event: PointerEvent<HTMLButtonElement>) => void
  onMove: (row: number, direction: "earlier" | "later") => void
  onAdd: (index: number) => void
}) {
  const [hover, setHover] = useState<{ row: number; part: "band" | "slide" | "handle" | "add" } | null>(null)
  const [focus, setFocus] = useState<{ row: number; part: "handle" | "add" } | null>(null)
  const { rows, width, height } = geometry
  const spacing = gridSpacing(width, height)
  const count = rows.at(-1)?.end ?? 0
  const columnsOf = (length: number) => `repeat(${length}, ${width}px)`
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: columnsOf(columns),
        columnGap: spacing.column,
        gridTemplateRows: tracks
          .map((track, index) => {
            const { world, fixed } = gridTrackSize(track, geometry, index === tracks.length - 1)
            return `${world + fixed / scale}px`
          })
          .join(" "),
      }}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse" || rowBlocked || !(event.target instanceof Element)) return
        const member = event.target.closest<HTMLElement>("[data-grid-row], [data-grid-row-member]")
        const row = Number(member?.dataset.gridRow ?? member?.dataset.gridRowMember)
        if (!Number.isFinite(row)) {
          if (hover !== null) setHover(null)
          return
        }
        const part =
          event.target.closest("[data-row-insert], [data-gap-insert]") !== null
            ? "add"
            : event.target.closest("[data-row-handle]") !== null
              ? "handle"
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
      {tracks.flatMap((track, index) => {
        const { start, end, heads, cards, number } = track
        const row = rows[number]
        if (row === undefined) return []
        const key = ids?.[start] ?? start
        const length = gridTrackColumns(track)
        const full = cards.length === end - start
        const place = { gridRow: index + 1, gridColumn: `1 / span ${length}` }
        const size = gridTrackSize(track, geometry, true)
        const rowHeight = size.world + size.fixed / scale
        const rowHover = hover?.row === row.start ? hover.part : null
        const rowFocus = focus?.row === row.start ? focus.part : null
        const tinted =
          !rowBlocked &&
          height * scale >= gridRowHandle.minimumHeight &&
          (rowHover === "handle" || (rowFocus === "handle" && rowHover !== "add"))
        return [
          ...(full
            ? [
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
              ]
            : []),
          ...[...new Set([...heads, ...cards])]
            .sort((a, b) => a - b)
            .map((index) => (
              <div
                key={ids?.[index] ?? index}
                data-grid-row-member={cards.length > 0 ? row.start : undefined}
                data-row-tint={tinted ? "" : undefined}
                className="pointer-events-none relative grid [&>div>div]:pointer-events-auto"
                style={{
                  ...place,
                  height: rowHeight,
                  gridTemplateColumns: columnsOf(length),
                  gridTemplateRows:
                    heads.length === 0
                      ? undefined
                      : cards.length === 0
                        ? `${gridHeadingHeight / scale}px`
                        : `${gridSectionHeight / scale}px 1fr`,
                  columnGap: spacing.column,
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
                  shown={cards.includes(index)}
                >
                  {cards.includes(index) ? renderCard(index) : null}
                </GridSectionCell>
              </div>
            )),
          ...(addBlocked || !full
            ? []
            : [
                <div
                  key={`add:${key}`}
                  data-grid-row-member={row.start}
                  className="pointer-events-none relative [&>[data-row-insert]]:pointer-events-auto"
                  style={{ ...place, height: rowHeight }}
                >
                  <GridRowAdd
                    row={number + 1}
                    width={width}
                    height={height}
                    gap={spacing.row}
                    scale={scale}
                    last={index === tracks.length - 1}
                    onAdd={() => onAdd(row.start)}
                  />
                </div>,
              ]),
        ]
      })}
    </div>
  )
}
