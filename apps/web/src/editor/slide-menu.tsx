import { memo, useEffect, type RefObject } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { slideListCopy } from "@/copy/slide-list-copy"
import type { SlideKey } from "@/editor/slide-keys"

export const slideMenuItem =
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

export const SlideMenu = memo(function SlideMenu({
  anchor,
  index,
  count,
  open,
  onOpenChange,
  onChoose,
}: {
  anchor: RefObject<HTMLButtonElement | null>
  index: number
  count: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (change: SlideKey) => void
}) {
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
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={onOpenChange}>
      <DropdownMenuContent
        anchor={anchor}
        finalFocus={false}
        side="right"
        align="start"
        sideOffset={8}
        className="flex w-[188px] min-w-0 flex-col rounded-xl bg-foreground p-1.5 text-white shadow-[0px_8px_24px_var(--black-20)] ring-0 duration-0"
      >
        <SlideMenuRows index={index} count={count} onChoose={onChoose} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

export function SlideMenuRows({
  index,
  count,
  onChoose,
  allowed,
  labels,
}: {
  index: number
  count: number
  onChoose: (change: SlideKey) => void
  allowed?: (change: SlideKey) => boolean
  labels?: Record<SlideKey, string>
}) {
  return order.map((change) => (
    <DropdownMenuItem
      key={change}
      disabled={!(allowed?.(change) ?? slideChangeAllowed(change, index, count))}
      aria-keyshortcuts={keys[change].shortcuts}
      className={slideMenuItem}
      onClick={() => onChoose(change)}
    >
      <span className="min-w-0 flex-1">{labels?.[change] ?? keys[change].label}</span>
      <span className="text-xs text-[var(--shortcut)]">{keys[change].shown}</span>
    </DropdownMenuItem>
  ))
}
