import { useCallback, useState, type ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { EditorIcon } from "@/components/ui/editor-icons"
import { slideListCopy } from "@/copy/slide-list-copy"
import { gestureFor } from "@/lib/gestures"

export function share(part: number, whole: number): string {
  return `${String((part / whole) * 100)}%`
}

export function GridGroupAdd({
  group,
  left,
  top,
  width,
  gap,
  column,
  preview,
  last,
  onAdd,
}: {
  readonly group: number
  readonly left: number
  readonly top: number
  readonly width: number
  readonly gap: number
  readonly column: number
  readonly preview: { readonly top: number; readonly height: number }
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
  const label = slideListCopy.addBelow(group)
  return (
    <div
      data-group-insert={last ? "last" : "between"}
      data-used={used ? "" : undefined}
      className="pointer-events-none absolute"
      style={{ left, top, width, height: gap }}
    >
      <div data-grid-overlay>
        <div
          data-group-preview
          className="absolute left-0 w-full"
          style={last ? { top: share(preview.top, gap), height: share(preview.height, gap) } : { top: "50%" }}
        >
          {last ? <GridPlaceholder kind="group" /> : <div data-group-insertion-line />}
        </div>
        <div
          ref={leaves}
          data-add-spot
          style={{
            left: last ? "50%" : "calc(var(--grid-add-size) / 2)",
            width: share(column, width),
            height: share(column, gap),
          }}
        >
          <GridAddButton
            data-add-group
            aria-label={label}
            title={label}
            onFocus={() => setUsed(false)}
            onClick={() => {
              setUsed(true)
              onAdd()
            }}
          />
        </div>
      </div>
    </div>
  )
}

export function GridPlaceholder({ kind }: { readonly kind: "gap" | "group" }) {
  return (
    <div
      data-group-placeholder={kind === "group" ? "" : undefined}
      data-gap-placeholder={kind === "gap" ? "" : undefined}
      aria-hidden="true"
      className="size-full"
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
      data-focus-edge
      {...props}
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
