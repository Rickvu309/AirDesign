import type * as doom from "@airdesign/doom"
import { memo, type CSSProperties, type ReactNode } from "react"
import { slideListCopy } from "@/copy/slide-list-copy"
import { slideNumberLabel } from "@/lib/slide-numbering"
import { GridGapAdd } from "@/editor/grid-gap-add"
import type { GridNumberPlacement } from "@/editor/grid-number"
import type { GridCard as Placed } from "@/editor/grid-lines"
import { SkippedSlide } from "@/editor/skipped-slide"
import { Thumb } from "./thumb"

export const GridCard = memo(function GridCard({
  card,
  placement,
  count,
  view,
  painted,
  current,
  selected,
  multiple,
  reachable,
  skipped,
  assetUrl,
  lifted,
  shiftX,
  shiftY,
  still,
  tinted,
  wrapped,
  addGap,
  addEnd,
  previewFits,
  onAdd,
  live,
}: {
  readonly card: Placed
  readonly placement: GridNumberPlacement
  readonly count: number
  readonly view: doom.Doom
  readonly painted: boolean
  readonly current: boolean
  readonly selected: boolean
  readonly multiple: boolean
  readonly reachable: boolean
  readonly skipped: boolean
  readonly assetUrl: (asset: string) => string | undefined
  readonly lifted: boolean
  readonly shiftX: number
  readonly shiftY: number
  readonly still: boolean
  readonly tinted: boolean
  readonly wrapped: boolean
  readonly addGap: number | null
  readonly addEnd: boolean
  readonly previewFits: boolean
  readonly onAdd: (index: number) => void
  readonly live?: ReactNode
}) {
  const number = card.index + 1
  const place: CSSProperties = {
    left: card.left,
    top: card.top,
    width: card.width,
    height: card.height,
    transform: shiftX === 0 && shiftY === 0 ? undefined : `translate(${String(shiftX)}px, ${String(shiftY)}px)`,
    transition: still ? "none" : "transform var(--ease-panel)",
  }
  return (
    <div
      className="absolute"
      style={place}
      data-grid-card
      data-selected={selected || undefined}
      data-number-placement={placement}
      data-lifted={lifted || undefined}
      data-group-tint={tinted || undefined}
      data-wrapped={wrapped || undefined}
    >
      <span data-grid-overlay>
        <span aria-hidden="true" data-grid-halo />
      </span>
      <button
        type="button"
        aria-current={current ? "true" : undefined}
        aria-label={
          multiple && selected ? slideListCopy.selectedName(number, count) : slideListCopy.slideName(number, count)
        }
        aria-description={skipped ? slideListCopy.skipped : undefined}
        tabIndex={reachable ? 0 : -1}
        className={
          live === undefined
            ? "absolute inset-0 overflow-hidden bg-white text-left"
            : "pointer-events-none absolute inset-0 overflow-hidden bg-white text-left"
        }
        data-slide-entry={number}
        data-selected={selected || undefined}
        data-slide-skipped={skipped || undefined}
      >
        <span
          className="pointer-events-none absolute top-0 left-0 block"
          style={{ width: card.width, height: card.height }}
          data-slide-thumb
        >
          {painted && live === undefined ? (
            <Thumb view={view} slide={card.id} width={card.width} assetUrl={assetUrl} />
          ) : null}
        </span>
        {skipped ? <SkippedSlide /> : null}
      </button>
      {live === undefined ? null : (
        <div className="absolute inset-0" data-grid-live>
          {live}
        </div>
      )}
      <span data-grid-overlay data-grid-front>
        <span aria-hidden="true" data-slide-number hidden={placement === "hidden"}>
          {slideNumberLabel(card.index, skipped)}
        </span>
      </span>
      {addGap === null ? null : (
        <GridGapAdd
          number={number}
          width={card.width}
          height={card.height}
          gap={addGap}
          end={addEnd}
          fits={previewFits}
          reachable={reachable}
          onAdd={() => onAdd(card.index)}
        />
      )}
    </div>
  )
})
