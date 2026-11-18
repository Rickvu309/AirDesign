import { useState, type ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { slideListCopy } from "@/copy/slide-list-copy"
import { EditorIcon } from "@/editor/editor-icons"

export function GridRowAdd({
  row,
  width,
  height,
  gap,
  scale,
  last,
  onAdd,
}: {
  row: number
  width: number
  height: number
  gap: number
  scale: number
  last: boolean
  onAdd: () => void
}) {
  const [used, setUsed] = useState(false)
  const band = last ? Math.min(gap, 48 / scale) : gap
  const label = slideListCopy.addBelow(row)
  return (
    <div
      data-row-insert={last ? "last" : "between"}
      data-used={used ? "" : undefined}
      className="absolute top-full left-0"
      style={{
        width,
        height: band,
        ...{ "--grid-row-preview-distance": `${gap + 24}px` },
      }}
      onPointerLeave={() => setUsed(false)}
    >
      <div
        data-row-preview
        className="pointer-events-none absolute"
        style={{ top: last ? "var(--grid-row-preview-distance)" : band / 2 }}
      >
        {last ? (
          <GridPlaceholder width={width} height={height} scale={scale} kind="row" />
        ) : (
          <div data-row-insertion-line style={{ width: width * scale, transform: `scale(${1 / scale})` }} />
        )}
      </div>
      <GridAddButton
        data-add-row
        aria-label={label}
        title={label}
        style={{
          left: width / 2,
          width: Math.min(44, width * scale),
          height: Math.min(44, band * scale),
          transform: `scale(${1 / scale}) translate(-50%, -50%)`,
          transformOrigin: "0 0",
        }}
        onFocus={() => setUsed(false)}
        onClick={() => {
          setUsed(true)
          onAdd()
        }}
      />
    </div>
  )
}

function fitPreview(node: HTMLDivElement | null) {
  const root = node?.closest("[data-grid-viewport]")
  if (!node || !root) return
  const observer = new IntersectionObserver(
    ([entry]) => {
      node.toggleAttribute("data-preview-fits", entry?.intersectionRatio === 1)
    },
    { root, threshold: 1 },
  )
  observer.observe(node)
  return () => observer.disconnect()
}

export function GridPlaceholder({
  width,
  height,
  scale,
  kind,
}: {
  width: number
  height: number
  scale: number
  kind: "gap" | "row"
}) {
  return (
    <div
      ref={fitPreview}
      data-row-placeholder={kind === "row" ? "" : undefined}
      data-gap-placeholder={kind === "gap" ? "" : undefined}
      aria-hidden="true"
      style={{
        width: width * scale,
        height: height * scale,
        ...{ "--grid-radius": `max(var(--grid-radius-min), calc(var(--grid-radius-canvas) * ${scale}))` },
        transform: `scale(${1 / scale})`,
        transformOrigin: "top left",
      }}
    >
      <svg className="block size-full">
        <rect data-grid-placeholder-border />
      </svg>
    </div>
  )
}

export function GridAddButton({ onClick, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="absolute rounded-full p-0 transition-none hover:bg-transparent active:translate-y-0"
      {...props}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget
          .closest("[data-focus-edge]")
          ?.querySelector<HTMLElement>('[data-slide-entry][tabindex="0"]')
          ?.focus({ preventScroll: true })
      }}
    >
      <span data-add-mark className="flex items-center justify-center rounded-full bg-primary text-primary-foreground">
        <EditorIcon name="plus" size={14} strokeWidth={2.5} />
      </span>
    </Button>
  )
}
