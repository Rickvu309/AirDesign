import type { SlideId } from "@airdesign/document"
import { useState, type CSSProperties, type PointerEvent, type ReactNode } from "react"
import { GridRowAdd } from "@/editor/grid-row-add"
import { GridRowFrame, GridRowHandle } from "@/editor/grid-row-frame"
import { GridSectionCell } from "@/editor/grid-section"
import { gridFrameHeight, gridGroupCenter, gridSlideCenters } from "@/editor/grid-lines"
import {
  gridLayoutLines,
  gridRowHandle,
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
  const lines = gridLayoutLines(geometry)
  const columnsOf = (length: number) => `repeat(${length}, ${width}px)`
  const groupAt = new Map<number, { first: number; last: number }>()
  for (const [index, line] of lines.entries()) {
    const known = groupAt.get(line.number)
    if (known === undefined) groupAt.set(line.number, { first: index, last: index })
    else known.last = index
  }
  const groups = [...groupAt.entries()]
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
      {groups.flatMap(([number, placeInGroup]) => {
        const row = rows[number]
        if (row === undefined) return null
        const { first, last } = placeInGroup
        const group = lines.slice(first, last + 1)
        const wrapped = group.length > 1
        const groupFull = group.reduce((total, item) => total + item.cards.length, 0) === row.end - row.start
        const key = ids?.[row.start] ?? row.start
        const name = sections.find((section) => section.start === row.start)?.name ?? undefined
        const measured = group.map((item) => ({ cards: item.cards, heading: 0 }))
        const gaps = group.map((_, offset) => gridTrackGap(geometry, lines, first + offset))
        const centers = gridSlideCenters(measured, height, gaps)
        const span = Math.max(...group.map(gridTrackColumns))
        const band = wrapped ? groupBand(centers, height, span, width, spacing.column, scale) : undefined
        const rowHover = hover?.row === row.start ? hover.part : null
        const rowFocus = focus?.row === row.start ? focus.part : null
        const tinted =
          !rowBlocked &&
          height * scale >= gridRowHandle.minimumHeight &&
          (rowHover === "handle" || (rowFocus === "handle" && rowHover !== "add"))
        const hidden = rowBlocked || height * scale < gridRowHandle.minimumHeight
        const frameHover = rowFocus === "add" ? "add" : rowHover
        const hostLine = lines[first]
        const tailLine = lines[last]
        if (hostLine === undefined || tailLine === undefined) return []
        const host = groupFull
          ? ([...new Set([...hostLine.heads, ...hostLine.cards])].sort((a, b) => a - b)[0] ?? -1)
          : -1
        const owned = group
          .flatMap((line) => [...new Set([...line.heads, ...line.cards])])
          .map((slide) => memberId(ids, slide))
        return [
          <div
            key={`group:${key}`}
            role="group"
            aria-label={name}
            aria-owns={owned.join(" ")}
            className="contents"
            data-slide-group={row.start}
          >
            {name === undefined ? null : <span className="sr-only">{name}</span>}
          </div>,
          host === -1 ? null : (
            <GridRowFrame
              key={`row:${key}`}
              start={row.start}
              scale={scale}
              blocked={hidden}
              hover={frameHover}
              tint={wrapped && tinted}
              band={band}
              style={{
                gridRow: wrapped ? `${first + 1} / span ${group.length}` : first + 1,
                gridColumn: `1 / span ${wrapped ? span : gridTrackColumns(hostLine)}`,
                alignSelf: wrapped ? "start" : undefined,
                height: wrapped ? gridFrameHeight(measured, height, gaps) : gridTrackSize(hostLine, geometry, 0).world,
              }}
            />
          ),
          ...group.flatMap((line, offset) => {
            const index = first + offset
            const length = gridTrackColumns(line)
            const place = { gridRow: index + 1, gridColumn: `1 / span ${length}` }
            const rowHeight = gridTrackSize(line, geometry, 0).world
            const members = [...new Set([...line.heads, ...line.cards])].sort((a, b) => a - b)
            return members.map((slide) => (
              <div
                key={ids?.[slide] ?? slide}
                id={memberId(ids, slide)}
                data-grid-row-member={line.cards.length > 0 ? row.start : undefined}
                data-row-tint={tinted ? "" : undefined}
                data-wrapped={wrapped && line.cards.length > 0 ? "" : undefined}
                className="pointer-events-none relative grid [&>div>div]:pointer-events-auto"
                style={{
                  ...place,
                  height: rowHeight,
                  gridTemplateColumns: columnsOf(length),
                  columnGap: spacing.column,
                }}
              >
                <GridSectionCell
                  row={line}
                  index={slide}
                  handle={
                    slide === host ? (
                      <GridRowHandle
                        number={line.number + 1}
                        scale={scale}
                        height={height}
                        blocked={rowBlocked}
                        center={wrapped ? gridGroupCenter(centers) : undefined}
                        onGrab={(event) => onGrab(row.start, event)}
                        onMove={(direction) => {
                          setHover(null)
                          onMove(line.number, direction)
                        }}
                      />
                    ) : undefined
                  }
                >
                  {line.cards.includes(slide) ? renderCard(slide) : null}
                </GridSectionCell>
              </div>
            ))
          }),
          addBlocked || !groupFull ? null : (
            <div
              key={`add:${key}`}
              data-grid-row-member={row.start}
              className="pointer-events-none relative [&>[data-row-insert]]:pointer-events-auto"
              style={{
                gridRow: last + 1,
                gridColumn: `1 / span ${gridTrackColumns(tailLine)}`,
                height: gridTrackSize(tailLine, geometry, 0).world,
              }}
            >
              <GridRowAdd
                row={number + 1}
                width={width}
                height={height}
                gap={spacing.row}
                scale={scale}
                last={last === lines.length - 1}
                onAdd={() => onAdd(row.start)}
              />
            </div>
          ),
        ]
      })}
    </div>
  )
}

function memberId(ids: readonly SlideId[] | undefined, slide: number): string {
  return `grid-member-${ids?.[slide] ?? slide}`
}

function groupBand(
  centers: readonly number[],
  slide: number,
  span: number,
  width: number,
  columnGap: number,
  scale: number,
): CSSProperties | undefined {
  const first = centers[0]
  const last = centers.at(-1)
  if (first === undefined || last === undefined) return undefined
  const top = first - slide / 2
  const bottom = last + slide / 2
  const inner = span * width + Math.max(0, span - 1) * columnGap
  return {
    top: `calc(${top}px - var(--grid-halo-band) / ${scale})`,
    height: `calc(${bottom - top}px + (var(--grid-halo-band) + var(--grid-halo-band-outset)) / ${scale})`,
    left: `calc(-1 * var(--grid-halo-band-outset) / ${scale})`,
    width: `calc(${inner}px + 2 * var(--grid-halo-band-outset) / ${scale})`,
    background: "var(--grid-hover)",
  }
}
