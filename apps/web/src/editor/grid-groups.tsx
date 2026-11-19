import type { SlideId } from "@airdesign/document"
import { useState, type CSSProperties, type PointerEvent, type ReactNode } from "react"
import { GridGroupAdd } from "@/editor/grid-group-add"
import { GridGroupFrame, GridGroupHandle } from "@/editor/grid-group-frame"
import { GridGroupCell } from "@/editor/grid-group"
import { gridFrameHeight, gridGroupCenter, gridSlideCenters } from "@/editor/grid-lines"
import {
  gridLayoutLines,
  gridGroupHandle,
  gridSpacing,
  gridTrackColumns,
  gridTrackGap,
  gridTrackSize,
  type GridGeometry,
} from "@/editor/grid-viewport"
import type { StripGroup } from "@/editor/slide-sidebar"

export function GridGroups({
  geometry,
  named,
  ids,
  columns,
  scale,
  renderCard,
  addBlocked,
  groupBlocked,
  onGrab,
  onMove,
  onAdd,
}: {
  geometry: GridGeometry
  named: readonly StripGroup[]
  ids: readonly SlideId[] | undefined
  columns: number
  scale: number
  renderCard: (index: number) => ReactNode
  addBlocked: boolean
  groupBlocked: boolean
  onGrab: (index: number, event: PointerEvent<HTMLButtonElement>) => void
  onMove: (group: number, direction: "earlier" | "later") => void
  onAdd: (index: number) => void
}) {
  const [hover, setHover] = useState<{ group: number; part: "band" | "slide" | "handle" | "add" } | null>(null)
  const [focus, setFocus] = useState<{ group: number; part: "handle" | "add" } | null>(null)
  const { groups, width, height } = geometry
  const spacing = gridSpacing(width, height)
  const lines = gridLayoutLines(geometry)
  const columnsOf = (length: number) => `repeat(${length}, ${width}px)`
  const spanOf = new Map<number, { first: number; last: number }>()
  for (const [index, line] of lines.entries()) {
    const known = spanOf.get(line.number)
    if (known === undefined) spanOf.set(line.number, { first: index, last: index })
    else known.last = index
  }
  const spans = [...spanOf.entries()]
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
        if (event.pointerType !== "mouse" || groupBlocked || !(event.target instanceof Element)) return
        const member = event.target.closest<HTMLElement>("[data-grid-group], [data-grid-group-member]")
        const group = Number(member?.dataset.gridGroup ?? member?.dataset.gridGroupMember)
        if (!Number.isFinite(group)) {
          if (hover !== null) setHover(null)
          return
        }
        const part =
          event.target.closest("[data-group-insert], [data-gap-insert]") !== null
            ? "add"
            : event.target.closest("[data-group-handle]") !== null
              ? "handle"
              : event.target.closest("[data-slide-entry], [data-slide-number], [data-grid-edit]") !== null
                ? "slide"
                : "band"
        if (hover?.group !== group || hover.part !== part) setHover({ group, part })
      }}
      onPointerLeave={() => setHover(null)}
      onPointerDown={(event) => {
        if (event.pointerType === "touch") setHover(null)
      }}
      onFocus={(event) => {
        if (!event.target.matches(":focus-visible")) return
        const member = event.target.closest<HTMLElement>("[data-grid-group], [data-grid-group-member]")
        if (member === null) return
        const group = Number(member.dataset.gridGroup ?? member.dataset.gridGroupMember)
        if (event.target.matches("[data-group-handle]")) setFocus({ group, part: "handle" })
        else if (event.target.matches("[data-add-group]")) setFocus({ group, part: "add" })
      }}
      onBlur={() => {
        if (focus !== null) setFocus(null)
      }}
    >
      {spans.flatMap(([number, span]) => {
        const group = groups[number]
        if (group === undefined) return null
        const { first, last } = span
        const groupLines = lines.slice(first, last + 1)
        const wrapped = groupLines.length > 1
        const groupFull = groupLines.reduce((total, item) => total + item.cards.length, 0) === group.end - group.start
        const key = ids?.[group.start] ?? group.start
        const name = named.find((entry) => entry.start === group.start)?.name ?? undefined
        const measured = groupLines.map((item) => ({ cards: item.cards, heading: 0 }))
        const gaps = groupLines.map((_, offset) => gridTrackGap(geometry, lines, first + offset))
        const centers = gridSlideCenters(measured, height, gaps)
        const spanColumns = Math.max(...groupLines.map(gridTrackColumns))
        const band = wrapped ? groupBand(centers, height, spanColumns, width, spacing.column, scale) : undefined
        const groupHover = hover?.group === group.start ? hover.part : null
        const groupFocus = focus?.group === group.start ? focus.part : null
        const tinted =
          !groupBlocked &&
          height * scale >= gridGroupHandle.minimumHeight &&
          (groupHover === "handle" || (groupFocus === "handle" && groupHover !== "add"))
        const hidden = groupBlocked || height * scale < gridGroupHandle.minimumHeight
        const frameHover = groupFocus === "add" ? "add" : groupHover
        const hostLine = lines[first]
        const tailLine = lines[last]
        if (hostLine === undefined || tailLine === undefined) return []
        const host = groupFull
          ? ([...new Set([...hostLine.heads, ...hostLine.cards])].sort((a, b) => a - b)[0] ?? -1)
          : -1
        const owned = groupLines
          .flatMap((line) => [...new Set([...line.heads, ...line.cards])])
          .map((slide) => memberId(ids, slide))
        return [
          <div
            key={`group:${key}`}
            role="group"
            aria-label={name}
            aria-owns={owned.join(" ")}
            className="contents"
            data-slide-group={group.start}
          >
            {name === undefined ? null : <span className="sr-only">{name}</span>}
          </div>,
          host === -1 ? null : (
            <GridGroupFrame
              key={`frame:${key}`}
              start={group.start}
              scale={scale}
              blocked={hidden}
              hover={frameHover}
              tint={wrapped && tinted}
              band={band}
              style={{
                gridRow: wrapped ? `${first + 1} / span ${groupLines.length}` : first + 1,
                gridColumn: `1 / span ${wrapped ? spanColumns : gridTrackColumns(hostLine)}`,
                alignSelf: wrapped ? "start" : undefined,
                height: wrapped ? gridFrameHeight(measured, height, gaps) : gridTrackSize(hostLine, geometry, 0).world,
              }}
            />
          ),
          ...groupLines.flatMap((line, offset) => {
            const index = first + offset
            const length = gridTrackColumns(line)
            const place = { gridRow: index + 1, gridColumn: `1 / span ${length}` }
            const rowHeight = gridTrackSize(line, geometry, 0).world
            const members = [...new Set([...line.heads, ...line.cards])].sort((a, b) => a - b)
            return members.map((slide) => (
              <div
                key={ids?.[slide] ?? slide}
                id={memberId(ids, slide)}
                data-grid-group-member={line.cards.length > 0 ? group.start : undefined}
                data-group-tint={tinted ? "" : undefined}
                data-wrapped={wrapped && line.cards.length > 0 ? "" : undefined}
                className="pointer-events-none relative grid [&>div>div]:pointer-events-auto"
                style={{
                  ...place,
                  height: rowHeight,
                  gridTemplateColumns: columnsOf(length),
                  columnGap: spacing.column,
                }}
              >
                <GridGroupCell
                  group={line}
                  index={slide}
                  handle={
                    slide === host ? (
                      <GridGroupHandle
                        number={line.number + 1}
                        scale={scale}
                        height={height}
                        blocked={groupBlocked}
                        center={wrapped ? gridGroupCenter(centers) : undefined}
                        onGrab={(event) => onGrab(group.start, event)}
                        onMove={(direction) => {
                          setHover(null)
                          onMove(line.number, direction)
                        }}
                      />
                    ) : undefined
                  }
                >
                  {line.cards.includes(slide) ? renderCard(slide) : null}
                </GridGroupCell>
              </div>
            ))
          }),
          addBlocked || !groupFull ? null : (
            <div
              key={`add:${key}`}
              data-grid-group-member={group.start}
              className="pointer-events-none relative [&>[data-group-insert]]:pointer-events-auto"
              style={{
                gridRow: last + 1,
                gridColumn: `1 / span ${gridTrackColumns(tailLine)}`,
                height: gridTrackSize(tailLine, geometry, 0).world,
              }}
            >
              <GridGroupAdd
                group={number + 1}
                width={width}
                height={height}
                gap={spacing.line}
                scale={scale}
                last={last === lines.length - 1}
                onAdd={() => onAdd(group.start)}
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
