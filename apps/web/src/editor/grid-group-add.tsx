import { useCallback, useState, type ComponentProps, type CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import { EditorIcon } from "@/components/ui/editor-icons"
import { slideListCopy } from "@/copy/slide-list-copy"
import { gestureFor } from "@/lib/gestures"

const addTarget = 44

export function GridGroupAdd({
  group,
  left,
  top,
  width,
  gap,
  preview,
  last,
  onAdd,
}: {
  readonly group: number
  readonly left: number
  readonly top: number
  readonly width: number
  readonly gap: number
  readonly preview: { readonly top: number; readonly height: number; readonly fits: boolean }
  readonly last: boolean
  readonly onAdd: () => void
}) {
  const [used, setUsed] = useState(false)
  const leaves = useCallback((node: HTMLDivElement | null) => {
    if (node === null) return
    const leave = () => setUsed(false)
    node.addEventListener("pointerleave", leave)
    return () => node.removeEventListener("pointerleave", leave)
  }, [])
  const band = last ? Math.min(gap, 48) : gap
  const label = slideListCopy.addBelow(group)
  return (
    <div
      ref={leaves}
      data-group-insert={last ? "last" : "between"}
      data-used={used ? "" : undefined}
      className="absolute"
      style={{
        left,
        top,
        width,
        height: band,
        ...{ "--grid-group-preview-distance": `${String(preview.top)}px` },
      }}
    >
      <div
        data-group-preview
        className="pointer-events-none absolute left-0"
        style={{ top: last ? preview.top : band / 2 }}
      >
        {last ? (
          <GridPlaceholder width={width} height={preview.height} kind="group" fits={preview.fits} />
        ) : (
          <div data-group-insertion-line style={{ width }} />
        )}
      </div>
      <GridAddButton
        data-add-group
        aria-label={label}
        title={label}
        style={{ left: width / 2, top: "50%", width: Math.min(addTarget, width), height: Math.min(addTarget, band) }}
        onFocus={() => setUsed(false)}
        onClick={() => {
          setUsed(true)
          onAdd()
        }}
      />
    </div>
  )
}

export function GridPlaceholder({
  width,
  height,
  kind,
  fits,
}: {
  readonly width: number
  readonly height: number
  readonly kind: "gap" | "group"
  readonly fits: boolean
}) {
  return (
    <div
      data-preview-fits={fits ? "" : undefined}
      data-group-placeholder={kind === "group" ? "" : undefined}
      data-gap-placeholder={kind === "gap" ? "" : undefined}
      aria-hidden="true"
      style={{ width, height }}
    >
      <svg className="block size-full">
        <rect data-grid-placeholder-border />
      </svg>
    </div>
  )
}

export function GridAddButton({ onClick, style, ...props }: ComponentProps<typeof Button>) {
  const place: CSSProperties = { transform: "translate(-50%, -50%)", ...style }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="absolute rounded-full p-0 transition-none hover:bg-transparent active:translate-y-0"
      {...props}
      style={place}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.(event)
      }}
      onKeyDown={(event) => {
        if (gestureFor(event.nativeEvent, "grid") !== "deselect") return
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget
          .closest("[data-slide-list]")
          ?.querySelector<HTMLElement>('[data-slide-entry][tabindex="0"]')
          ?.focus({ preventScroll: true, focusVisible: true })
      }}
    >
      <span data-add-mark className="flex items-center justify-center rounded-full bg-primary text-primary-foreground">
        <EditorIcon name="plus" size={14} strokeWidth={2.5} />
      </span>
    </Button>
  )
}
