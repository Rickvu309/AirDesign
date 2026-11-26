import { useEffect, useState, type PointerEvent, type RefObject } from "react"
import { Button } from "@/components/ui/button"
import { slideListCopy } from "@/copy/slide-list-copy"
import { gridGroupCommand } from "@/editor/editor-grid-keys"
import type { GridBand } from "@/editor/grid-drop"
import type { GridRect } from "@/editor/grid-lines"
import { gridGrip } from "@/editor/grid-viewport"

export type GridGroupHover = "band" | "slide" | "handle" | "add"

const gripReach = 52

function partOf(target: EventTarget | null): GridGroupHover {
  if (!(target instanceof Element)) return "band"
  if (target.closest("[data-group-handle]") !== null) return "handle"
  if (target.closest("[data-gap-insert], [data-group-insert]") !== null) return "add"
  return target.closest("[data-grid-card]") === null ? "band" : "slide"
}

export function groupHoverAt(
  bands: readonly GridBand[],
  world: { readonly x: number; readonly y: number },
  target: EventTarget | null,
  scale: number,
): { readonly group: number; readonly part: GridGroupHover } | null {
  const part = partOf(target)
  const reach = gripReach / scale
  const above = gridGrip.minimumHeight / 2 / scale
  const group =
    part === "add"
      ? bands.findLastIndex((band) => band.top <= world.y)
      : bands.findIndex(
          (band) => world.x >= -reach && world.x <= band.width && world.y >= band.top - above && world.y <= band.bottom,
        )
  return group === -1 ? null : { group, part }
}

type Hovered = { readonly group: number; readonly part: GridGroupHover } | null

export function useGroupHover({
  host,
  bands,
  scale,
  world,
  blocked,
}: {
  readonly host: RefObject<HTMLElement | null>
  readonly bands: readonly GridBand[]
  readonly scale: number
  readonly world: (point: { readonly x: number; readonly y: number }) => { readonly x: number; readonly y: number }
  readonly blocked: boolean
}) {
  const [hover, setHover] = useState<Hovered>(null)
  useEffect(() => {
    const element = host.current
    if (element === null) return
    const leave = () => setHover(null)
    element.addEventListener("pointerleave", leave)
    return () => element.removeEventListener("pointerleave", leave)
  }, [host])
  return {
    hover,
    clear: () => setHover(null),
    move: (event: PointerEvent<HTMLElement>) => {
      const next =
        event.pointerType !== "mouse" || blocked
          ? null
          : groupHoverAt(bands, world({ x: event.clientX, y: event.clientY }), event.target, scale)
      if (next?.group !== hover?.group || next?.part !== hover?.part) setHover(next)
    },
  }
}

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
      data-group-blocked={blocked ? "" : undefined}
      data-group-tint={tint ? "" : undefined}
      data-wrapped={wrapped ? "" : undefined}
      className="pointer-events-none absolute"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    >
      <span data-group-band aria-hidden="true" className="absolute" />
      {grips ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-group-handle
          aria-label={slideListCopy.moveGroup(number + 1)}
          aria-keyshortcuts={slideListCopy.groupKeys}
          disabled={blocked}
          className="absolute"
          style={{
            left: -gridGrip.offset,
            top: "50%",
            zIndex: 10,
            width: gridGrip.width,
            transform: "translate(-50%, -50%)",
          }}
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
        </Button>
      ) : null}
    </div>
  )
}
