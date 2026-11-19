import type { SlideId } from "@airdesign/document"
import { useLayoutEffect, useRef, type CSSProperties, type PointerEvent, type RefObject } from "react"
import { slideListCopy } from "@/copy/slide-list-copy"
import { gridGroupHandle } from "@/editor/grid-viewport"
import { gridIndices, type GridMoveSide } from "@/editor/grid-drop"
import { gridCommand } from "@/editor/editor-grid-keys"

export function GridGroupFrame({
  start,
  scale,
  blocked,
  hover,
  style,
  tint = false,
  band,
}: {
  start: number
  scale: number
  blocked: boolean
  hover: "band" | "slide" | "handle" | "add" | null
  style: CSSProperties
  tint?: boolean
  band?: CSSProperties
}) {
  return (
    <div
      data-grid-group-frame
      data-grid-group={start}
      data-group-hover={blocked ? undefined : (hover ?? undefined)}
      data-group-blocked={blocked ? "" : undefined}
      data-group-tint={tint ? "" : undefined}
      className="relative"
      style={style}
    >
      <span aria-hidden="true" className="absolute inset-y-0" style={{ left: -52 / scale, width: 52 / scale }} />
      {band === undefined ? null : (
        <span data-group-band aria-hidden="true" className="pointer-events-none absolute" style={band} />
      )}
    </div>
  )
}

export function GridGroupHandle({
  number,
  scale,
  height,
  blocked,
  center,
  onGrab,
  onMove,
}: {
  number: number
  scale: number
  height: number
  blocked: boolean
  center?: number
  onGrab: (event: PointerEvent<HTMLButtonElement>) => void
  onMove: (direction: "earlier" | "later") => void
}) {
  return (
    <button
      type="button"
      data-group-handle
      aria-label={slideListCopy.moveGroup(number)}
      aria-keyshortcuts={slideListCopy.groupKeys}
      disabled={blocked || height * scale < gridGroupHandle.minimumHeight}
      style={{
        left: -gridGroupHandle.offset / scale,
        width: gridGroupHandle.width,
        top: center === undefined ? `calc(100% - ${height / 2}px)` : center,
        transform: `scale(${1 / scale}) translate(-50%, -50%)`,
        transformOrigin: "0 0",
      }}
      className="pointer-events-auto absolute z-10 flex touch-none items-center justify-center rounded-full"
      onPointerDown={(event) => {
        event.stopPropagation()
        event.currentTarget.focus({ preventScroll: true, focusVisible: false })
        onGrab(event)
      }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        const command = gridCommand(event)
        if (command !== "earlier" && command !== "later") return
        event.preventDefault()
        event.stopPropagation()
        onMove(command)
      }}
    >
      <span data-group-grip aria-hidden="true" className="flex items-center justify-center rounded-full">
        <svg
          width="12"
          height="16"
          viewBox="0 0 12 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M3 3h6M3 8h6M3 13h6" />
        </svg>
      </span>
    </button>
  )
}

export function moveGridGroup(
  groups: readonly { readonly start: number; readonly end: number }[],
  number: number,
  direction: "earlier" | "later",
  move: (held: readonly number[], at: number, side: GridMoveSide) => void,
) {
  const group = groups[number]
  const target = number + (direction === "earlier" ? -1 : 1)
  const next = groups[target]
  if (group === undefined || next === undefined) return
  const at = direction === "earlier" ? next.start : next.end
  move(gridIndices(group), at, "keep")
}

export function useGridGroupFocus(
  list: RefObject<HTMLDivElement | null>,
  groups: readonly { readonly start: number }[],
  ids: readonly SlideId[],
) {
  const pending = useRef<{ readonly head: SlideId; readonly to: number; readonly order: string } | null>(null)
  const order = ids.join(",")
  useLayoutEffect(() => {
    const wanted = pending.current
    if (wanted === null || order === wanted.order) return
    pending.current = null
    if (ids[groups[wanted.to]?.start ?? -1] !== wanted.head) return
    const handle = list.current?.querySelectorAll<HTMLButtonElement>("[data-group-handle]")[wanted.to]
    handle?.focus({ preventScroll: true, focusVisible: true })
  }, [list, groups, ids, order])
  return (held: readonly number[], at: number) => {
    const head = ids[held[0] ?? -1]
    if (head === undefined) return
    pending.current = { head, to: groups.filter((group) => group.start < at && group.start !== held[0]).length, order }
  }
}

export function gridMoveMessage(
  groups: readonly { readonly start: number }[],
  held: readonly number[],
  at: number,
  group: boolean,
): string {
  const first = at - held.filter((index) => index < at).length
  if (!group)
    return held.length === 1
      ? slideListCopy.moved((held[0] ?? first) + 1, first + 1)
      : slideListCopy.movedSeveral(held.length, first + 1)
  const from = groups.findIndex((range) => range.start === held[0])
  const to = groups.filter((range) => range.start < at && range.start !== held[0]).length
  return slideListCopy.groupMoved(from + 1, to + 1)
}
