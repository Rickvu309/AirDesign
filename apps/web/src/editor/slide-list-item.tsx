import { gestureFor } from "@airdesign/render"
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import { slideListCopy } from "@/copy/slide-list-copy"
import type { SlideKey } from "@/editor/slide-keys"
import { SlideMenu, type SlideMenuSet } from "@/editor/slide-menu"
import { slidePress, type SlidePress } from "@/editor/slide-list-pick"
import { SkippedSlide } from "@/editor/skipped-slide"
import { cn } from "@/lib/class-names"

export function SlideItem({
  index,
  count = 0,
  active,
  picked = false,
  menuSet,
  reachable = true,
  working = false,
  skipped = false,
  onSkip,
  onSelect,
  onChoose,
  onKeyDown,
  onDragStart,
  onDragOver,
  onDrop,
  children,
}: {
  index: number
  count?: number
  active: boolean
  picked?: boolean
  menuSet?: SlideMenuSet | undefined
  reachable?: boolean
  working?: boolean
  skipped?: boolean
  onSkip?: ((skipped: boolean) => void) | undefined
  onSelect?: (press: SlidePress) => void
  onChoose?: (change: SlideKey) => void
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void
  children: ReactNode
}) {
  const entry = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const latest = useRef({ onSelect, onChoose })
  useLayoutEffect(() => {
    latest.current = { onSelect, onChoose }
  })
  const onMenuChoose = useCallback((change: SlideKey) => latest.current.onChoose?.(change), [])
  const onMenuOpenChange = useCallback((next: boolean) => {
    setMenuOpen(next)
    if (next) latest.current.onSelect?.("menu")
    else if (entry.current?.isConnected) entry.current.focus()
  }, [])
  const look = cn(
    "flex w-fit items-start gap-2 rounded-[var(--shape-card)] py-1.5 pr-1.5 pl-2",
    active || picked ? "bg-[var(--row)]" : onSelect !== undefined && "hover:bg-black/4",
  )
  const number = (
    <span className="flex w-4 flex-col items-center gap-1.5 pt-0.5">
      <span className={cn("text-xs", active ? "font-medium text-index" : "text-quiet")}>{index}</span>
      {skipped ? <SkippedSlide /> : null}
      {working ? <span className="block size-1.5 rounded-full bg-primary" /> : null}
    </span>
  )
  if (onSelect === undefined) {
    return (
      <div className={look} data-slide-item>
        {number}
        {children}
      </div>
    )
  }
  const openMenu = () => {
    onSelect?.("menu")
    setMenuOpen(true)
  }
  return (
    <div className="relative">
      <button
        ref={entry}
        type="button"
        draggable={onDragStart !== undefined}
        aria-current={active ? "true" : undefined}
        aria-label={picked ? slideListCopy.selectedName(index, count) : slideListCopy.slideName(index, count)}
        aria-description={skipped ? slideListCopy.skipped : undefined}
        data-slide-skipped={skipped || undefined}
        tabIndex={reachable ? 0 : -1}
        className={cn(look, "relative text-left")}
        data-stop={`slide:${String(index - 1)}`}
        data-slide-entry={index}
        data-slide-item
        data-selected={picked || undefined}
        onClick={(event) => onSelect(slidePress(event))}
        onContextMenu={
          onChoose === undefined
            ? undefined
            : (event) => {
                event.preventDefault()
                openMenu()
              }
        }
        onKeyDown={(event) => {
          if (onChoose !== undefined && gestureFor(event, "slides") === "slide-menu") {
            event.preventDefault()
            openMenu()
            return
          }
          onKeyDown?.(event)
        }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {number}
        {children}
      </button>
      {onChoose === undefined ? null : (
        <SlideMenu
          anchor={entry}
          index={index - 1}
          count={count}
          open={menuOpen}
          onOpenChange={onMenuOpenChange}
          onChoose={onMenuChoose}
          skipped={skipped}
          onSkip={onSkip}
          set={menuSet}
        />
      )}
    </div>
  )
}
