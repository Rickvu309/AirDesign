import { slideListCopy } from "@/copy/slide-list-copy"
import { GridAddButton, GridPlaceholder } from "@/editor/grid-group-add"

const addTarget = 44

export function GridGapAdd({
  number,
  width,
  height,
  gap,
  end,
  reachable,
  onAdd,
}: {
  readonly number: number
  readonly width: number
  readonly height: number
  readonly gap: number
  readonly end: boolean
  readonly reachable: boolean
  readonly onAdd: () => void
}) {
  const label = slideListCopy.addAfter(number)
  return (
    <div
      data-gap-insert={end ? "end" : "between"}
      className="absolute top-0"
      style={{ left: width, width: gap, height }}
    >
      <GridAddButton
        tabIndex={reachable ? 0 : -1}
        data-add-gap
        aria-label={label}
        title={label}
        style={{
          left: gap / 2,
          top: height / 2,
          width: Math.min(addTarget, gap),
          height: Math.min(addTarget, height),
        }}
        onClick={onAdd}
      />
      {end ? (
        <div data-gap-preview className="pointer-events-none absolute top-0" style={{ left: gap }}>
          <GridPlaceholder width={width} height={height} kind="gap" />
        </div>
      ) : null}
    </div>
  )
}
