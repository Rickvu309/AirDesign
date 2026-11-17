import { gridNumberPlacement, gridElementPresses } from "@/editor/grid-number"
import { gridSpacing } from "@/editor/grid-viewport"
import { Filmstrip } from "@airdesign/render"
import type { CSSProperties, ReactNode, MouseEventHandler, PointerEventHandler } from "react"
import { GridGapAdd } from "@/editor/grid-gap-add"
import { slideListCopy } from "@/copy/slide-list-copy"
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
  onPress,
  onPressed,
  onClick,
  onContextMenu,
  onAdd,
  rowEnd,
  addBlocked,
  addDisabled,
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
  onPress: PointerEventHandler<HTMLDivElement>
  onPressed: MouseEventHandler<HTMLDivElement>
  onClick: MouseEventHandler<HTMLElement>
  onContextMenu: MouseEventHandler<HTMLButtonElement>
  rowEnd: boolean
  addBlocked: boolean
  addDisabled: boolean
  onAdd: () => void
}) {
  const screen = { width: width * scale, gap: gridSpacing(width, height).row * scale }
  const placement = gridNumberPlacement(screen)
  return (
    <div
      className="group relative flex flex-col items-start gap-2"
      data-selected={selected ? "true" : undefined}
      data-grid-card
      data-grid-small={!gridElementPresses(screen) ? "" : undefined}
      data-number-placement={placement}
      data-hover-disabled={busy || active ? "true" : undefined}
      style={{ ...shift, height: height + 24, ...{ "--grid-scale": scale } }}
      onDragStart={(event) => event.preventDefault()}
      onPointerDownCapture={onPress}
      onClickCapture={onPressed}
    >
      <span
        aria-hidden="true"
        data-grid-halo
        style={{
          top: 24,
          width: width * scale,
          height: height * scale,
          transform: `scale(${1 / scale})`,
          transformOrigin: "0 0",
        }}
      />
      <button
        type="button"
        aria-current={current ? "true" : undefined}
        aria-label={
          multiple && selected
            ? slideListCopy.selectedName(index + 1, count)
            : slideListCopy.slideName(index + 1, count)
        }
        tabIndex={reachable ? 0 : -1}
        data-slide-entry={index + 1}
        data-selected={selected ? "" : undefined}
        className={cn("absolute top-6 left-0 overflow-hidden text-left", dragging && "pointer-events-none opacity-40")}
        style={{
          transform: `scale(${1 / scale})`,
          transformOrigin: "0 0",
          borderRadius: "var(--grid-radius)",
        }}
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        <Filmstrip
          className={cn(thumbFace, active && "invisible")}
          height={height * scale}
          paint={() => thumb(width * scale)}
          width={width * scale}
        />
      </button>
      <span
        aria-hidden="true"
        data-slide-number
        onClick={onClick}
        hidden={placement === "hidden"}
        style={{
          top: 24,
          transform: `scale(${1 / scale}) translateY(${placement === "above" ? -24 : 0}px)`,
          transformOrigin: "0 0",
        }}
      >
        {index + 1}
      </span>
      {active ? (
        <div
          className={cn(
            "absolute top-6 left-0 isolate [&>div]:shadow-none",
            dragging && "pointer-events-none opacity-40",
          )}
          style={{ transform: `scale(${1 / scale})`, transformOrigin: "0 0", borderRadius: "var(--grid-radius)" }}
          data-grid-edit
        >
          {slide?.(width * scale)}
        </div>
      ) : null}
      <GridGapAdd
        reachable={reachable}
        index={index}
        width={width}
        height={height}
        scale={scale}
        end={rowEnd}
        blocked={addBlocked}
        disabled={addDisabled}
        onAdd={onAdd}
      />
    </div>
  )
}
