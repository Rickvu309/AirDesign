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

export type SlideMenuSet = {
  readonly size: number
  readonly allowed: (change: SlideKey) => boolean
  readonly skipped: boolean
}

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
  skipped,
  onSkip,
  set,
}: {
  anchor: RefObject<HTMLButtonElement | null>
  index: number
  count: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (change: SlideKey) => void
  skipped: boolean
  onSkip: ((skipped: boolean) => void) | undefined
  set?: SlideMenuSet | undefined
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
        className="flex w-max min-w-[188px] flex-col rounded-xl bg-foreground p-1.5 text-white shadow-[0px_8px_24px_var(--black-20)] ring-0 duration-0"
      >
        {set === undefined ? (
          <SlideMenuRows index={index} count={count} onChoose={onChoose} />
        ) : (
          <SlideMenuRows
            index={index}
            count={count}
            onChoose={onChoose}
            allowed={set.allowed}
            labels={slideListCopy.setActions(set.size)}
          />
        )}
        {onSkip === undefined ? null : (
          <SlideSkipItem
            skipped={set?.skipped ?? skipped}
            onSkip={onSkip}
            {...(set === undefined ? {} : { count: set.size })}
          />
        )}
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

export function SlideSkipItem({
  skipped,
  onSkip,
  count = 1,
}: {
  skipped: boolean
  onSkip: (skipped: boolean) => void
  count?: number
}) {
  const single = skipped ? slideListCopy.unskip : slideListCopy.skip
  const set = skipped ? slideListCopy.unskipSet : slideListCopy.skipSet
  return (
    <DropdownMenuItem className={slideMenuItem} onClick={() => onSkip(!skipped)}>
      {count === 1 ? single : set(count)}
    </DropdownMenuItem>
  )
}
