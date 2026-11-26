import type { PointerEvent } from "react"
import { slideListCopy } from "@/copy/slide-list-copy"
import { gridGroupCommand } from "@/editor/editor-grid-keys"
import type { GridRect } from "@/editor/grid-lines"
import { gridGrip } from "@/editor/grid-viewport"

export type GridGroupHover = "band" | "slide" | "handle" | "add"

export function GridGroupFrame({
  number,
  box,
  hover,
  tint,
  wrapped,
  blocked,
  grips,
  onGrab,
  onMove,
  onFocusGrip,
}: {
  readonly number: number
  readonly box: GridRect
  readonly hover: GridGroupHover | null
  readonly tint: boolean
  readonly wrapped: boolean
  readonly blocked: boolean
  readonly grips: boolean
  readonly onGrab: (event: PointerEvent<HTMLButtonElement>) => void
  readonly onMove: (direction: "up" | "down") => void
  readonly onFocusGrip: (focused: boolean) => void
}) {
  return (
    <div
      data-grid-group-frame
      data-grid-group={number}
      data-group-hover={blocked ? undefined : (hover ?? undefined)}
      data-group-tint={tint ? "" : undefined}
      data-wrapped={wrapped ? "" : undefined}
      className="pointer-events-none absolute"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    >
      <span data-group-band aria-hidden="true" className="absolute" />
      {grips ? (
        <button
          type="button"
          data-group-handle
          aria-label={slideListCopy.moveGroup(number + 1)}
          aria-keyshortcuts={slideListCopy.groupKeys}
          disabled={blocked}
          className="pointer-events-auto absolute top-1/2 z-10 flex touch-none items-center justify-center rounded-full"
          style={{ left: -gridGrip.offset, width: gridGrip.width, transform: "translate(-50%, -50%)" }}
          onPointerDown={(event) => {
            event.stopPropagation()
            event.currentTarget.focus({ preventScroll: true, focusVisible: false })
            onGrab(event)
          }}
          onClick={(event) => event.stopPropagation()}
          onFocus={(event) => onFocusGrip(event.currentTarget.matches(":focus-visible"))}
          onBlur={() => onFocusGrip(false)}
          onKeyDown={(event) => {
            const direction = gridGroupCommand(event)
            if (direction === null) return
            event.preventDefault()
            event.stopPropagation()
            onMove(direction)
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
      ) : null}
    </div>
  )
}
