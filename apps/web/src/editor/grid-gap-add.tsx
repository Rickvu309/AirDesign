import { slideListCopy } from "@/copy/slide-list-copy"
import { gridElementPresses } from "@/editor/grid-number"
import { GridAddButton, GridPlaceholder } from "@/editor/grid-row-add"
import { gridSpacing } from "@/editor/grid-viewport"

export function GridGapAdd({
  index,
  width,
  height,
  scale,
  end,
  blocked,
  disabled,
  onAdd,
  reachable,
}: {
  reachable: boolean
  index: number
  width: number
  height: number
  scale: number
  end: boolean
  blocked: boolean
  disabled: boolean
  onAdd: () => void
}) {
  const gap = gridSpacing(width, height).column
  const available = gridElementPresses({ width: width * scale, gap: gap * scale })
  return (
    <div
      data-gap-insert={end ? "end" : "between"}
      inert={blocked || !available}
      style={{ position: "absolute", left: width, top: 24, width: gap, height }}
    >
      <GridAddButton
        type="button"
        variant="ghost"
        size="icon"
        tabIndex={reachable ? 0 : -1}
        data-add-gap
        aria-label={slideListCopy.addAfter(index + 1)}
        title={slideListCopy.addAfter(index + 1)}
        disabled={disabled}
        className="absolute rounded-full p-0 transition-none hover:bg-transparent active:translate-y-0"
        style={{
          left: gap / 2,
          top: height / 2,
          width: Math.min(44, gap * scale),
          height: 44,
          transform: `scale(${1 / scale}) translate(-50%, -50%)`,
          transformOrigin: "0 0",
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onAdd()
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return
          event.preventDefault()
          event.stopPropagation()
          event.currentTarget
            .closest("[data-grid-card]")
            ?.querySelector<HTMLElement>("[data-slide-entry]")
            ?.focus({ preventScroll: true })
        }}
      />
      {end ? (
        <div data-gap-preview className="pointer-events-none absolute hidden" style={{ left: gap, top: 0 }}>
          <GridPlaceholder width={width} height={height} scale={scale} gap />
        </div>
      ) : null}
    </div>
  )
}
