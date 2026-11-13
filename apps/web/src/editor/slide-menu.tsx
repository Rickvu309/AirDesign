import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import { createPortal } from "react-dom"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { slideListCopy } from "@/copy/slide-list-copy"
import { hairlineShadow } from "@/editor/editor-chrome"
import type { SlideKey } from "@/editor/slide-keys"
import { cn } from "@/lib/class-names"

const item =
  "h-8 gap-2.5 rounded-md py-0 pr-2.5 pl-2 text-[length:var(--type-dense)] text-white focus:bg-quiet focus:text-white not-data-[variant=destructive]:focus:**:text-white"

const keys: Record<SlideKey, { readonly label: string; readonly shown: string; readonly shortcuts: string }> = {
  clone: { label: slideListCopy.duplicate, shown: slideListCopy.duplicateKey, shortcuts: "Control+D Meta+D" },
  remove: { label: slideListCopy.delete, shown: slideListCopy.deleteKey, shortcuts: "Delete Backspace" },
  up: { label: slideListCopy.moveUp, shown: slideListCopy.moveUpKey, shortcuts: "Alt+ArrowUp" },
  down: { label: slideListCopy.moveDown, shown: slideListCopy.moveDownKey, shortcuts: "Alt+ArrowDown" },
}

const order: readonly SlideKey[] = ["clone", "remove", "up", "down"]

export function slideChangeAllowed(change: SlideKey, index: number, count: number): boolean {
  if (change === "clone") return true
  if (change === "remove") return count > 1
  if (change === "up") return index > 0
  return index < count - 1
}

function clipToList(anchor: HTMLElement, node: HTMLElement): void {
  const box = node.getBoundingClientRect()
  const frame = anchor.closest("[data-slide-list]")?.getBoundingClientRect()
  const seen =
    frame === undefined ||
    (box.top >= frame.top - 1 &&
      box.bottom <= frame.bottom + 1 &&
      box.left >= frame.left - 1 &&
      box.right <= frame.right + 1)
  node.style.visibility = seen ? "visible" : "hidden"
  node.style.pointerEvents = seen ? "auto" : "none"
}

export function SlideMenu({
  number,
  index,
  count,
  anchor,
  anchorRef,
  open,
  onOpenChange,
  onChoose,
  returnFocus,
}: {
  number: number
  index: number
  count: number
  anchor: string
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (change: SlideKey) => void
  returnFocus: RefObject<HTMLElement | null>
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const anchorNode = anchorRef.current
    const node = trigger.current
    const root = anchorNode?.closest("[data-editor-sidebar]")
    const next = root instanceof HTMLElement ? root : document.body
    setHost((held) => (held === next ? held : next))
    if (anchorNode === null || node === null) return
    const place = () => clipToList(anchorNode, node)
    place()
    const list = anchorNode.closest("[data-slide-list]")
    list?.addEventListener("scroll", place, { passive: true })
    window.addEventListener("resize", place)
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(place) : undefined
    observer?.observe(anchorNode)
    if (observer !== undefined && list !== null) {
      observer.observe(list)
      for (const child of list.children) {
        if (child !== node) observer.observe(child)
      }
    }
    return () => {
      list?.removeEventListener("scroll", place)
      window.removeEventListener("resize", place)
      observer?.disconnect()
    }
  }, [anchorRef, host])
  useEffect(() => {
    if (!open) return
    let frame = 0
    let tries = 0
    const focusFirst = () => {
      const row = document.querySelector<HTMLElement>(
        '[data-slot="dropdown-menu-content"] [role="menuitem"]:not([aria-disabled="true"])',
      )
      row?.focus()
      if (row !== null && document.activeElement === row) return
      if (tries >= 8) return
      tries += 1
      frame = requestAnimationFrame(focusFirst)
    }
    focusFirst()
    return () => cancelAnimationFrame(frame)
  }, [open])
  const menu = (
    <DropdownMenu modal={false} open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        ref={trigger}
        type="button"
        tabIndex={-1}
        aria-label={slideListCopy.actions(number)}
        data-slide-actions={number}
        className={cn(
          "fixed z-10 flex size-8 items-center justify-center rounded-[var(--shape-control)] bg-white text-foreground",
          hairlineShadow,
        )}
        style={{
          positionAnchor: anchor,
          top: "calc(anchor(top) + 0.75rem)",
          left: "calc(anchor(right) - 3.25rem)",
        }}
      >
        <ActionsMark />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        finalFocus={returnFocus}
        side="right"
        align="start"
        sideOffset={8}
        className="flex w-[188px] min-w-0 flex-col rounded-xl bg-foreground p-1.5 text-white shadow-[0px_8px_24px_var(--black-20)] ring-0 duration-0"
      >
        {order.map((change) => (
          <DropdownMenuItem
            key={change}
            disabled={!slideChangeAllowed(change, index, count)}
            aria-keyshortcuts={keys[change].shortcuts}
            className={item}
            onClick={() => onChoose(change)}
          >
            <span className="min-w-0 flex-1">{keys[change].label}</span>
            <span className="text-xs text-[var(--shortcut)]">{keys[change].shown}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
  return host === null ? menu : createPortal(menu, host)
}

function ActionsMark() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true" className="shrink-0">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  )
}
