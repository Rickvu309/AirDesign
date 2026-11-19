import type { ReactNode, RefObject } from "react"

const ghostWidth = 160

export function GridDragGhost({
  ref,
  count,
  height,
  width,
  thumb,
  group,
}: {
  ref: RefObject<HTMLDivElement | null>
  count: number
  height: number
  width: number
  group?: readonly ((width: number) => ReactNode)[]
  thumb: (width: number) => ReactNode
}) {
  const rowWidth = group === undefined ? ghostWidth : Math.min(640, ghostWidth * group.length)
  const cellWidth = group === undefined ? ghostWidth : (rowWidth - 8 * (group.length - 1)) / group.length
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-group-drag={group === undefined ? undefined : ""}
      data-drag-ghost
      className="pointer-events-none fixed top-0 left-0 z-50"
      style={{
        width: rowWidth,
        display: "flex",
        gap: 8,
      }}
    >
      {group === undefined
        ? null
        : group.map((paint, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-[var(--grid-radius)] bg-white shadow-[var(--shadow-grid-selected)]"
              style={{
                width: cellWidth,
                height: (cellWidth * height) / width,
              }}
            >
              {paint(cellWidth)}
            </div>
          ))}
      <div
        hidden={group !== undefined}
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
          className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-strong px-1.5 text-[length:var(--type-caption)] leading-none font-semibold text-primary-foreground tabular-nums"
        >
          {count}
        </span>
      ) : null}
    </div>
  )
}
