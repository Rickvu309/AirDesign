import { useState, type ComponentProps, type CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import { slideListCopy } from "@/copy/slide-list-copy"
import { EditorIcon } from "@/editor/editor-icons"

export function GridRowAdd({
  row,
  width,
  height,
  gap,
  scale,
  blocked,
  disabled,
  onAdd,
  onEscape,
}: {
  row: number
  width: number
  height: number
  gap: number
  scale: number
  blocked: boolean
  disabled: boolean
  onAdd: () => void
  onEscape: () => void
}) {
  const [state, setState] = useState<"ready" | "used">("ready")
  const space: CSSProperties & { readonly "--grid-row-preview-space": string } = {
    position: "relative",
    "--grid-row-preview-space": `${height + 24 + gap}px`,
  }
  return (
    <div data-row-insert={state} style={space} inert={blocked}>
      <GridAddButton
        type="button"
        variant="ghost"
        size="icon"
        data-add-row
        aria-label={slideListCopy.addBelow(row)}
        title={slideListCopy.addBelow(row)}
        disabled={disabled}
        className="absolute size-11 touch-manipulation rounded-full p-0 hover:bg-transparent active:translate-y-0"
        style={{
          left: width / 2,
          top: Math.min(gap / 2, 24 / scale),
          transform: `scale(${1 / scale}) translate(-50%, -50%)`,
          transformOrigin: "0 0",
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerLeave={() => setState("ready")}
        onFocus={() => setState("ready")}
        onClick={(event) => {
          event.stopPropagation()
          setState("used")
          onAdd()
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return
          event.preventDefault()
          event.stopPropagation()
          onEscape()
        }}
      />
      <div data-row-preview className="pointer-events-none absolute hidden" style={{ top: gap + 24 }}>
        <GridPlaceholder width={width} height={height} scale={scale} />
      </div>
    </div>
  )
}

export function GridAddMark() {
  return (
    <span
      data-add-mark
      className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
    >
      <EditorIcon name="plus" size={14} strokeWidth={2.5} />
    </span>
  )
}

export function GridPlaceholder({
  width,
  height,
  scale,
  gap = false,
}: {
  width: number
  height: number
  scale: number
  gap?: boolean
}) {
  return (
    <div
      data-row-placeholder={gap ? undefined : ""}
      data-gap-placeholder={gap ? "" : undefined}
      className="border border-dashed border-[var(--grid-placeholder-edge)] bg-[var(--grid-placeholder)]"
      style={{
        width: width * scale,
        height: height * scale,
        borderRadius: "var(--grid-radius)",
        transform: `scale(${1 / scale})`,
        transformOrigin: "top left",
      }}
    />
  )
}

export function GridAddButton(props: ComponentProps<typeof Button>) {
  return (
    <Button type="button" variant="ghost" size="icon" {...props}>
      <GridAddMark />
    </Button>
  )
}
