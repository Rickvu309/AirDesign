import type { SlideId } from "@airdesign/document"
import { useState, type CSSProperties, type PointerEvent, type ReactNode } from "react"
import { GridRowAdd } from "@/editor/grid-row-add"
import { GridRowFrame } from "@/editor/grid-row-frame"
import { GridSectionCell } from "@/editor/grid-section"
import { gridFrameHeight, gridGroupCenter, gridSlideCenters } from "@/editor/grid-lines"
import {
  gridHeadingHeight,
  gridLayoutLines,
  gridRowHandle,
  gridSectionHeight,
  gridSpacing,
  gridTrackColumns,
  gridTrackGap,
  gridTrackSize,
  type GridGeometry,
} from "@/editor/grid-viewport"
import type { StripSection } from "@/editor/slide-sidebar"

export function GridRows({
  geometry,
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
  const lines = gridLayoutLines(geometry)
  const columnsOf = (length: number) => `repeat(${length}, ${width}px)`
  const groupAt = new Map<number, { first: number; last: number }>()
  for (const [index, line] of lines.entries()) {
    const known = groupAt.get(line.number)
    if (known === undefined) groupAt.set(line.number, { first: index, last: index })
    else known.last = index
  }
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: columnsOf(columns),
        columnGap: spacing.column,
        gridTemplateRows: lines
          .map((line, index) => {
            const { world, fixed } = gridTrackSize(line, geometry, gridTrackGap(geometry, lines, index))
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
      {lines.flatMap((line, index) => {
        const row = rows[line.number]
        const placeInGroup = groupAt.get(line.number)
        if (row === undefined || placeInGroup === undefined) return []
        const { first, last } = placeInGroup
        const group = lines.slice(first, last + 1)
        const wrapped = group.length > 1
        const groupFull = group.reduce((total, item) => total + item.cards.length, 0) === row.end - row.start
        const key = ids?.[line.start] ?? line.start
        const length = gridTrackColumns(line)
        const place = { gridRow: index + 1, gridColumn: `1 / span ${length}` }
        const size = gridTrackSize(line, geometry, 0)
        const rowHeight = size.world + size.fixed / scale
        const rowHover = hover?.row === row.start ? hover.part : null
        const rowFocus = focus?.row === row.start ? focus.part : null
        const tinted =
          !rowBlocked &&
          height * scale >= gridRowHandle.minimumHeight &&
          (rowHover === "handle" || (rowFocus === "handle" && rowHover !== "add"))
        const measured = group.map((item) => ({
          cards: item.cards,
          heading: gridTrackSize(item, geometry, 0).fixed / scale,
        }))
        const gaps = group.map((_, offset) => gridTrackGap(geometry, lines, first + offset))
        const centers = gridSlideCenters(measured, height, gaps)
        const span = Math.max(...group.map(gridTrackColumns))
        const band = wrapped ? groupBand(centers, height, span, width, spacing.column, scale) : undefined
        return [
          ...(groupFull && index === first
            ? [
                <GridRowFrame
                  key={`row:${key}`}
                  number={line.number + 1}
                  start={row.start}
                  height={height}
                  scale={scale}
                  blocked={rowBlocked}
                  hover={rowFocus === "add" ? "add" : rowHover}
                  tint={wrapped && tinted}
                  center={wrapped ? gridGroupCenter(centers) : undefined}
                  rule={band?.rule}
                  band={band?.band}
                  style={{
                    gridRow: wrapped ? `${first + 1} / span ${group.length}` : index + 1,
                    gridColumn: `1 / span ${wrapped ? span : length}`,
                    alignSelf: wrapped ? "start" : undefined,
                    height: wrapped ? gridFrameHeight(measured, height, gaps) : rowHeight,
                  }}
                  onGrab={(event) => onGrab(row.start, event)}
                  onMove={(direction) => {
                    setHover(null)
                    onMove(line.number, direction)
                  }}
                />,
              ]
            : []),
          ...[...new Set([...line.heads, ...line.cards])]
            .sort((a, b) => a - b)
            .map((slide) => (
              <div
                key={ids?.[slide] ?? slide}
                data-grid-row-member={line.cards.length > 0 ? row.start : undefined}
                data-row-tint={tinted ? "" : undefined}
                data-wrapped={wrapped && line.cards.length > 0 ? "" : undefined}
                className="pointer-events-none relative grid [&>div>div]:pointer-events-auto"
                style={{
                  ...place,
                  height: rowHeight,
                  gridTemplateColumns: columnsOf(length),
                  gridTemplateRows:
                    line.heads.length === 0
                      ? undefined
                      : line.cards.length === 0
                        ? `${gridHeadingHeight / scale}px`
                        : `${gridSectionHeight / scale}px 1fr`,
                  columnGap: spacing.column,
                }}
              >
                <GridSectionCell
                  row={line}
                  index={slide}
                  sections={sections}
                  count={count}
                  scale={scale}
                  pitch={width + spacing.column}
                  held={collapsed.held}
                  onToggle={collapsed.toggle}
                  shown={line.cards.includes(slide)}
                >
                  {line.cards.includes(slide) ? renderCard(slide) : null}
                </GridSectionCell>
              </div>
            )),
          ...(addBlocked || !groupFull || index !== last
            ? []
            : [
                <div
                  key={`add:${key}`}
                  data-grid-row-member={row.start}
                  className="pointer-events-none relative [&>[data-row-insert]]:pointer-events-auto"
                  style={{ ...place, height: rowHeight }}
                >
                  <GridRowAdd
                    row={line.number + 1}
                    width={width}
                    height={height}
                    gap={spacing.row}
                    scale={scale}
                    last={index === lines.length - 1}
                    onAdd={() => onAdd(row.start)}
                  />
                </div>,
              ]),
        ]
      })}
    </div>
  )
}

function groupBand(
  centers: readonly number[],
  slide: number,
  span: number,
  width: number,
  columnGap: number,
  scale: number,
): { rule: CSSProperties; band: CSSProperties } | undefined {
  const first = centers[0]
  const last = centers.at(-1)
  if (first === undefined || last === undefined) return undefined
  const top = first - slide / 2
  const bottom = last + slide / 2
  const inner = span * width + Math.max(0, span - 1) * columnGap
  return {
    rule: {
      top,
      height: bottom - top,
      left: `calc(-1 * var(--grid-number-halo-width) / ${scale})`,
      width: `calc(var(--grid-number-halo-width) / ${scale})`,
    },
    band: {
      top: `calc(${top}px - var(--grid-halo-band) / ${scale})`,
      height: `calc(${bottom - top}px + (var(--grid-halo-band) + var(--grid-halo-band-outset)) / ${scale})`,
      left: `calc(-1 * var(--grid-halo-band-outset) / ${scale})`,
      width: `calc(${inner}px + 2 * var(--grid-halo-band-outset) / ${scale})`,
      background: "var(--grid-hover)",
    },
  }
}
