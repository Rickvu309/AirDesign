import type { ReactNode, RefObject } from "react"

const ghostWidth = 160

export function GridDragGhost({
  ref,
  count,
  height,
  width,
  thumb,
}: {
  ref: RefObject<HTMLDivElement | null>
  count: number
  height: number
  width: number
  thumb: (width: number) => ReactNode
}) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-drag-ghost
      className="pointer-events-none fixed top-0 left-0 z-50"
      style={{ width: ghostWidth }}
    >
      <div
        className="overflow-hidden bg-white opacity-90"
        style={{
          width: ghostWidth,
          height: Math.round((ghostWidth * height) / Math.max(1, width)),
          borderRadius: "var(--grid-radius)",
          boxShadow: "var(--shadow-grid-selected)",
        }}
      >
        {thumb(ghostWidth)}
      </div>
      {count > 1 ? (
        <span
          data-drag-count
          className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[length:var(--type-caption)] leading-none font-semibold text-primary-foreground tabular-nums"
        >
          {count}
        </span>
      ) : null}
    </div>
  )
}
