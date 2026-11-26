import type * as doom from "@airdesign/doom"
import { memo, type CSSProperties } from "react"
import { slideListCopy } from "@/copy/slide-list-copy"
import { slideNumberLabel } from "@/lib/slide-numbering"
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
}) {
  const number = card.index + 1
  const place: CSSProperties = { left: card.left, top: card.top, width: card.width, height: card.height }
  return (
    <div
      className="absolute"
      style={place}
      data-grid-card
      data-selected={selected || undefined}
      data-number-placement={placement}
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
        className="absolute inset-0 overflow-hidden bg-white text-left"
        data-slide-entry={number}
        data-selected={selected || undefined}
        data-slide-skipped={skipped || undefined}
      >
        <span
          className="pointer-events-none absolute top-0 left-0 block"
          style={{ width: card.width, height: card.height }}
          data-slide-thumb
        >
          {painted ? <Thumb view={view} slide={card.id} width={card.width} assetUrl={assetUrl} /> : null}
        </span>
        {skipped ? <SkippedSlide /> : null}
      </button>
      <span data-grid-overlay data-grid-front>
        <span aria-hidden="true" data-slide-number hidden={placement === "hidden"}>
          {slideNumberLabel(card.index, skipped)}
        </span>
      </span>
    </div>
  )
})
