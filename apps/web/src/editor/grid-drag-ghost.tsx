import type * as doom from "@airdesign/doom"
import type { RefObject } from "react"
import { Thumb } from "./thumb"

const ghostWidth = 160
const groupWidth = 640
const groupGap = 8

export function GridDragGhost({
  ref,
  view,
  slides,
  group,
  size,
  assetUrl,
}: {
  readonly ref: RefObject<HTMLDivElement | null>
  readonly view: doom.Doom
  readonly slides: readonly doom.NodeId[]
  readonly group: boolean
  readonly size: { readonly width: number; readonly height: number }
  readonly assetUrl: (asset: string) => string | undefined
}) {
  const shown = group ? slides : slides.slice(0, 1)
  const row = group ? Math.min(groupWidth, ghostWidth * shown.length) : ghostWidth
  const cell = group ? (row - groupGap * (shown.length - 1)) / shown.length : ghostWidth
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-drag-ghost
      data-group-drag={group ? "" : undefined}
      className="pointer-events-none fixed top-0 left-0 z-50 flex"
      style={{ width: row, gap: groupGap }}
    >
      {shown.map((slide) => (
        <div
          key={slide}
          className="overflow-hidden rounded-[var(--grid-radius-min)] bg-white shadow-[var(--shadow-grid-selected)]"
          style={{ width: cell, height: (cell * size.height) / Math.max(1, size.width), opacity: group ? 1 : 0.9 }}
        >
          <span
            className="block origin-top-left"
            style={{ width: size.width, height: size.height, transform: `scale(${String(cell / size.width)})` }}
          >
            <Thumb view={view} slide={slide} width={size.width} assetUrl={assetUrl} />
          </span>
        </div>
      ))}
      {slides.length > 1 ? (
        <span
          data-drag-count
          className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-strong px-1.5 text-[length:var(--type-caption)] leading-none font-semibold text-primary-foreground tabular-nums"
        >
          {slides.length}
        </span>
      ) : null}
    </div>
  )
}
