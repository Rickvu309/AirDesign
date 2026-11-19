import { slideListCopy } from "@/copy/slide-list-copy"
import { GridAddButton, GridPlaceholder } from "@/editor/grid-group-add"
import { gridSpacing } from "@/editor/grid-viewport"

export function GridGapAdd({
  index,
  width,
  height,
  scale,
  end,
  onAdd,
  reachable,
}: {
  reachable: boolean
  index: number
  width: number
  height: number
  scale: number
  end: boolean
  onAdd: () => void
}) {
  const gap = gridSpacing(width, height).column
  const label = slideListCopy.addAfter(index + 1)
  return (
    <div
      data-gap-insert={end ? "end" : "between"}
      style={{ position: "absolute", left: width, top: 24, width: gap, height }}
    >
      <GridAddButton
        tabIndex={reachable ? 0 : -1}
        data-add-gap
        aria-label={label}
        title={label}
        style={{
          left: gap / 2,
          top: height / 2,
          width: Math.min(44, gap * scale),
          height: Math.min(44, height * scale),
          transform: `scale(${1 / scale}) translate(-50%, -50%)`,
          transformOrigin: "0 0",
        }}
        onClick={onAdd}
      />
      {end ? (
        <div data-gap-preview className="pointer-events-none absolute" style={{ left: gap, top: 0 }}>
          <GridPlaceholder width={width} height={height} scale={scale} kind="gap" />
        </div>
      ) : null}
    </div>
  )
}
