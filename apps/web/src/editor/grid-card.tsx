import type * as doom from "@airdesign/doom"
import { memo, type CSSProperties } from "react"
import { slideListCopy } from "@/copy/slide-list-copy"
import { slideNumberLabel } from "@/lib/slide-numbering"
import { gridNumberPlacement } from "@/editor/grid-number"
import type { GridCard as Placed } from "@/editor/grid-lines"
import { SkippedSlide } from "@/editor/skipped-slide"
import { Thumb } from "./thumb"

export const GridCard = memo(function GridCard({
  card,
  scale,
  gap,
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
  readonly scale: number
  readonly gap: number
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
  const width = card.width * scale
  const number = card.index + 1
  const placement = gridNumberPlacement({ width, gap: gap * scale })
  const place: CSSProperties & Record<"--grid-scale", number> = {
    left: card.left * scale,
    top: card.top * scale,
    width,
    height: card.height * scale,
    "--grid-scale": scale,
  }
  return (
    <div
      className="absolute"
      style={place}
      data-grid-card
      data-selected={selected || undefined}
      data-number-placement={placement}
    >
      <span aria-hidden="true" data-grid-halo />
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
          className="pointer-events-none absolute top-0 left-0 block origin-top-left"
          style={{ width: card.width, height: card.height, transform: `scale(${String(scale)})` }}
          data-slide-thumb
        >
          {painted ? <Thumb view={view} slide={card.id} width={card.width} assetUrl={assetUrl} /> : null}
        </span>
        {skipped ? <SkippedSlide /> : null}
      </button>
      <span aria-hidden="true" data-slide-number hidden={placement === "hidden"}>
        {slideNumberLabel(card.index, skipped)}
      </span>
    </div>
  )
})
