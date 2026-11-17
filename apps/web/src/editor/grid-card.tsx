import { Filmstrip } from "@airdesign/render"
import type { CSSProperties, ReactNode, MouseEventHandler, DragEventHandler } from "react"
import { Button } from "@/components/ui/button"
import { slideListCopy } from "@/copy/slide-list-copy"
import { EditorIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"

const thumbFace = "block overflow-hidden rounded-[inherit] bg-white"

export function GridCard({
  index,
  count,
  current,
  selected,
  multiple,
  reachable,
  dragging,
  busy,
  active,
  scale,
  width,
  height,
  shift,
  thumb,
  slide,
  onClick,
  onContextMenu,
  onDragStart,
  onAdd,
}: {
  index: number
  count: number
  current: boolean
  selected: boolean
  multiple: boolean
  reachable: boolean
  dragging: boolean
  busy: boolean
  active: boolean
  scale: number
  width: number
  height: number
  shift: CSSProperties | undefined
  thumb: (width: number) => ReactNode
  slide: ((width: number) => ReactNode) | undefined
  onClick: MouseEventHandler<HTMLButtonElement>
  onContextMenu: MouseEventHandler<HTMLButtonElement>
  onDragStart: DragEventHandler<HTMLButtonElement>
  onAdd: () => void
}) {
  return (
    <div
      className="group relative flex flex-col items-start gap-2"
      data-grid-card
      style={{ ...shift, height: height + 24 }}
    >
      <span
        aria-hidden="true"
        data-slide-number
        hidden={width * scale < 160}
        style={{
          position: "absolute",
          bottom: `calc(100% - ${24 - 8 / scale}px)`,
          transform: `scale(${1 / scale})`,
          transformOrigin: "bottom left",
        }}
        className={cn(
          "h-4 text-[length:var(--type-caption)] leading-4 tabular-nums",
          current ? "font-semibold text-primary-strong" : "text-quiet",
        )}
      >
        {index + 1}
      </span>
      <button
        type="button"
        draggable
        aria-current={current ? "true" : undefined}
        aria-label={
          multiple && selected
            ? slideListCopy.selectedName(index + 1, count)
            : slideListCopy.slideName(index + 1, count)
        }
        tabIndex={reachable ? 0 : -1}
        data-slide-entry={index + 1}
        className={cn("absolute top-6 left-0 overflow-hidden text-left", dragging && "pointer-events-none opacity-40")}
        style={{
          transform: `scale(${1 / scale})`,
          transformOrigin: "0 0",
          borderRadius: "var(--grid-radius)",
          boxShadow: selected ? "var(--shadow-grid-selected)" : "var(--shadow-grid)",
        }}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onDragStart={onDragStart}
      >
        <Filmstrip
          className={cn(thumbFace, active && "invisible")}
          height={height * scale}
          paint={() => thumb(width * scale)}
          width={width * scale}
        />
      </button>
      {active ? (
        <div
          className="absolute top-6 left-0 overflow-hidden [&>div]:shadow-none"
          style={{ transform: `scale(${1 / scale})`, transformOrigin: "0 0", borderRadius: "var(--grid-radius)" }}
          data-grid-edit
        >
          {slide?.(width * scale)}
        </div>
      ) : null}
      <span
        className="absolute left-full flex items-center justify-center"
        style={{
          top: 24 + height / 2,
          width: 32,
          height: 0,
          transform: `scale(${1 / scale})`,
          transformOrigin: "left center",
        }}
      >
        <Button
          type="button"
          variant="default"
          tabIndex={-1}
          aria-label={slideListCopy.addAfter(index + 1)}
          className={cn(
            "invisible relative flex size-4 scale-75 self-center rounded-full p-0 opacity-0 transition-[opacity,scale,visibility] duration-[var(--duration-micro)] ease-[var(--ease-out)] after:absolute after:-inset-1 hover:bg-primary-strong",
            !busy && "group-hover:visible group-hover:scale-100 group-hover:opacity-100",
          )}
          onClick={onAdd}
        >
          <EditorIcon name="plus" size={10} strokeWidth={3.2} />
        </Button>
      </span>
    </div>
  )
}
