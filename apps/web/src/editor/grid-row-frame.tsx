import type { SlideId } from "@airdesign/document"
import { useLayoutEffect, useRef, type CSSProperties, type PointerEvent, type RefObject } from "react"
import { slideListCopy } from "@/copy/slide-list-copy"
import { gridRowHandle } from "@/editor/grid-viewport"
import { gridIndices, type GridMoveSide } from "@/editor/grid-drop"
import { gridCommand } from "@/editor/editor-grid-keys"

export function GridRowFrame({
  number,
  scale,
  height,
  blocked,
  onGrab,
  onMove,
  hover,
  style,
  start,
}: {
  number: number
  scale: number
  height: number
  blocked: boolean
  onGrab: (event: PointerEvent<HTMLButtonElement>) => void
  onMove: (direction: "earlier" | "later") => void
  hover: "band" | "slide" | "handle" | "add" | null
  style: CSSProperties
  start: number
}) {
  const small = height * scale < gridRowHandle.minimumHeight
  return (
    <div
      data-grid-row-frame
      data-grid-row={start}
      data-row-hover={blocked || small ? undefined : (hover ?? undefined)}
      data-row-blocked={blocked || small ? "" : undefined}
      className="relative"
      style={style}
    >
      <span aria-hidden="true" className="absolute inset-y-0" style={{ left: -52 / scale, width: 52 / scale }} />
      <button
        type="button"
        data-row-handle
        aria-label={slideListCopy.moveRow(number)}
        aria-keyshortcuts={slideListCopy.rowKeys}
        disabled={blocked || small}
        style={{
          left: -gridRowHandle.offset / scale,
          width: gridRowHandle.width,
          top: `calc(100% - ${height / 2}px)`,
          transform: `scale(${1 / scale}) translate(-50%, -50%)`,
          transformOrigin: "0 0",
        }}
        className="absolute z-10 flex touch-none items-center justify-center rounded-full"
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
        <span data-row-grip aria-hidden="true" className="flex items-center justify-center rounded-full">
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
    </div>
  )
}

export function moveGridRow(
  rows: readonly { readonly start: number; readonly end: number }[],
  number: number,
  direction: "earlier" | "later",
  move: (held: readonly number[], at: number, side: GridMoveSide) => void,
) {
  const row = rows[number]
  const target = number + (direction === "earlier" ? -1 : 1)
  const next = rows[target]
  if (row === undefined || next === undefined) return
  const at = direction === "earlier" ? next.start : next.end
  move(gridIndices(row), at, "keep")
}

export function useGridRowFocus(
  list: RefObject<HTMLDivElement | null>,
  rows: readonly { readonly start: number }[],
  ids: readonly SlideId[],
) {
  const pending = useRef<{ readonly head: SlideId; readonly to: number; readonly order: string } | null>(null)
  const order = ids.join(",")
  useLayoutEffect(() => {
    const wanted = pending.current
    if (wanted === null || order === wanted.order) return
    pending.current = null
    if (ids[rows[wanted.to]?.start ?? -1] !== wanted.head) return
    const handle = list.current?.querySelectorAll<HTMLButtonElement>("[data-row-handle]")[wanted.to]
    handle?.focus({ preventScroll: true, focusVisible: true })
  }, [list, rows, ids, order])
  return (held: readonly number[], at: number) => {
    const head = ids[held[0] ?? -1]
    if (head === undefined) return
    pending.current = { head, to: rows.filter((row) => row.start < at && row.start !== held[0]).length, order }
  }
}

export function gridMoveMessage(
  rows: readonly { readonly start: number }[],
  held: readonly number[],
  at: number,
  row: boolean,
): string {
  const first = at - held.filter((index) => index < at).length
  if (!row)
    return held.length === 1
      ? slideListCopy.moved((held[0] ?? first) + 1, first + 1)
      : slideListCopy.movedSeveral(held.length, first + 1)
  const from = rows.findIndex((range) => range.start === held[0])
  const to = rows.filter((range) => range.start < at && range.start !== held[0]).length
  return slideListCopy.rowMoved(from + 1, to + 1)
}
