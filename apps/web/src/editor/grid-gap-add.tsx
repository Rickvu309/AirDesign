import { slideListCopy } from "@/copy/slide-list-copy"
import { GridAddButton, GridPlaceholder, share } from "@/editor/grid-group-add"

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
      className="pointer-events-none absolute top-0"
      style={{ left: width, width: gap, height }}
    >
      <div data-grid-overlay>
        <div data-add-spot style={{ left: "50%", width: "100%", height: share(gap, height) }}>
          <GridAddButton tabIndex={reachable ? 0 : -1} data-add-gap aria-label={label} title={label} onClick={onAdd} />
        </div>
        {end ? (
          <div data-gap-preview className="absolute top-0 h-full" style={{ left: "100%", width: share(width, gap) }}>
            <GridPlaceholder kind="gap" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
