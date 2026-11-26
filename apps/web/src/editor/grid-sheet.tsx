import * as doom from "@airdesign/doom"
import type { PointerEvent, ReactNode } from "react"
import type { CanvasCard } from "@/editor/canvas"
import type { GridCarry } from "@/editor/canvas-carry"
import { GridCard } from "@/editor/grid-card"
import { GridDropBar } from "@/editor/grid-drag-marks"
import { gridIndices, type GridBand, type GridRange } from "@/editor/grid-drop"
import { GridGroupAdd } from "@/editor/grid-group-add"
import { GridGroupFrame, type GridGroupHover } from "@/editor/grid-group-frame"
import type { GridCard as Card, GridLayout } from "@/editor/grid-lines"
import type { GridNumberPlacement } from "@/editor/grid-number"
import { GridTargets } from "@/editor/grid-targets"
import type { SlideGeometry } from "@/editor/slide-geometry"
import type { GridDropBar as DropBar } from "@/editor/use-grid-drag"

type Point = { readonly x: number; readonly y: number }
type Room = { readonly width: number; readonly height: number }
type Spacing = { readonly column: number; readonly group: number; readonly line: number; readonly inset: number }

function inside(origin: Point, room: Room, scale: number, left: number, top: number, width: number, height: number) {
  const x = origin.x + left * scale
  const y = origin.y + top * scale
  return x >= 0 && y >= 0 && x + width * scale <= room.width && y + height * scale <= room.height
}

function tinted(
  group: number,
  blocked: boolean,
  grips: boolean,
  hover: { readonly group: number; readonly part: GridGroupHover } | null,
  gripFocus: number | null,
) {
  return (
    !blocked &&
    grips &&
    (hover?.group === group ? hover.part === "handle" : gripFocus === group && hover?.part !== "add")
  )
}

export function GridSheet({
  bands,
  cards,
  groups,
  view,
  count,
  placement,
  painted,
  current,
  selected,
  multiple,
  reachable,
  assetUrl,
  held,
  still,
  shift,
  spacing,
  addBlocked,
  origin,
  room,
  onAddGap,
  onAddGroup,
  liveSlide,
  live,
  carry,
  taking,
  handoff,
  onBlank,
  onMode,
  onGeometry,
  onRun,
  slidePoint,
  grips,
  blocked,
  hover,
  gripFocus,
  onGrab,
  onMoveSlides,
  clearHover,
  onFocusGrip,
  dropBar,
  marquee,
  scale,
}: {
  readonly bands: readonly GridBand[]
  readonly cards: GridLayout["cards"]
  readonly groups: readonly GridRange[]
  readonly view: doom.Doom
  readonly count: number
  readonly placement: GridNumberPlacement
  readonly painted: ReadonlySet<number>
  readonly current: number
  readonly selected: ReadonlySet<number>
  readonly multiple: boolean
  readonly reachable: number
  readonly assetUrl: (asset: string) => string | undefined
  readonly held: ReadonlySet<number>
  readonly still: boolean
  readonly shift: (index: number) => Point | null
  readonly spacing: Spacing
  readonly addBlocked: boolean
  readonly origin: Point
  readonly room: Room
  readonly onAddGap: (index: number) => void
  readonly onAddGroup: (index: number) => void
  readonly liveSlide: string | null
  readonly live: (slide: doom.NodeId, scale: number, card: CanvasCard) => ReactNode
  readonly carry: GridCarry
  readonly taking: doom.NodeId | null
  readonly handoff: CanvasCard["handoff"]
  readonly onBlank: CanvasCard["onBlank"]
  readonly onMode: CanvasCard["onMode"]
  readonly onGeometry: (slide: doom.NodeId, geometry: SlideGeometry | null) => void
  readonly onRun: CanvasCard["onRun"]
  readonly slidePoint: (card: Card, client: Point) => Point
  readonly grips: boolean
  readonly blocked: boolean
  readonly hover: { readonly group: number; readonly part: GridGroupHover } | null
  readonly gripFocus: number | null
  readonly onGrab: (index: number, event: PointerEvent<HTMLButtonElement>) => void
  readonly onMoveSlides: (moved: readonly number[], at: number, side: "keep") => void
  readonly clearHover: () => void
  readonly onFocusGrip: (group: number | null) => void
  readonly dropBar: DropBar | null
  readonly marquee: {
    readonly left: number
    readonly top: number
    readonly right: number
    readonly bottom: number
  } | null
  readonly scale: number
}) {
  return (
    <>
      {bands.map((band, number) => {
        const first = cards[band.start]
        if (first === undefined) return null
        const last = number === bands.length - 1
        return [
          <GridGroupFrame
            key={`frame:${first.id}`}
            number={number}
            box={{ left: 0, top: band.top, width: band.width, height: band.bottom - band.top }}
            hover={hover?.group === number ? hover.part : gripFocus === number ? "handle" : null}
            tint={tinted(number, blocked, grips, hover, gripFocus)}
            wrapped={band.wrapped}
            blocked={blocked}
            grips={grips}
            onGrab={(event) => onGrab(band.start, event)}
            onMove={(direction) => {
              clearHover()
              const next = groups[number + (direction === "up" ? -1 : 1)]
              const range = groups[number]
              if (next === undefined || range === undefined) return
              onMoveSlides(gridIndices(range), direction === "up" ? next.start : next.end, "keep")
            }}
            onFocusGrip={(focused) => onFocusGrip(focused ? number : null)}
          />,
          ...cards.slice(band.start, band.end).map((card) => {
            const moved = shift(card.index)
            return (
              <GridCard
                key={card.id}
                card={card}
                placement={placement}
                count={count}
                view={view}
                painted={painted.has(card.index)}
                current={card.index === current}
                selected={selected.has(card.index)}
                multiple={multiple}
                reachable={card.index === reachable}
                skipped={doom.propOf(view.nodes.get(card.id), "skipped") === true}
                assetUrl={assetUrl}
                lifted={held.has(card.index)}
                shiftX={moved?.x ?? 0}
                shiftY={moved?.y ?? 0}
                still={still}
                taking={card.id === taking}
                tinted={tinted(number, blocked, grips, hover, gripFocus)}
                wrapped={band.wrapped}
                addGap={addBlocked ? null : spacing.column}
                addEnd={card.index === band.end - 1}
                previewFits={
                  card.index === band.end - 1 &&
                  inside(
                    origin,
                    room,
                    scale,
                    card.left + card.width + spacing.column,
                    card.top,
                    card.width,
                    card.height,
                  )
                }
                onAdd={onAddGap}
                {...(liveSlide !== null && card.id === liveSlide
                  ? {
                      live: live(card.id, scale, {
                        handoff,
                        onBlank,
                        onMode,
                        onRun,
                        pointAt: (client) => slidePoint(card, client),
                        carry,
                      }),
                    }
                  : {})}
              />
            )
          }),
          addBlocked ? null : (
            <GridGroupAdd
              key={`add:${first.id}`}
              group={number + 1}
              left={0}
              top={band.bottom}
              width={first.width}
              gap={spacing.group}
              preview={{
                top: spacing.group + spacing.inset,
                height: first.height,
                fits: inside(
                  origin,
                  room,
                  scale,
                  0,
                  band.bottom + spacing.group + spacing.inset,
                  first.width,
                  first.height,
                ),
              }}
              last={last}
              onAdd={() => onAddGroup(band.end - 1)}
            />
          ),
        ]
      })}
      {cards.map((card) =>
        painted.has(card.index) || card.id === liveSlide ? (
          <GridTargets key={`targets:${card.id}`} view={view} slide={card.id} onGeometry={onGeometry} />
        ) : null,
      )}
      {dropBar === null ? null : <GridDropBar bar={dropBar} scale={scale} />}
      {marquee === null ? null : (
        <div
          aria-hidden="true"
          data-grid-marquee
          style={{
            transform: `translate(${String(marquee.left)}px, ${String(marquee.top)}px)`,
            width: marquee.right - marquee.left,
            height: marquee.bottom - marquee.top,
            ...{ "--grid-scale": String(scale) },
          }}
        />
      )}
    </>
  )
}
