import { memo, useEffect, type ComponentProps, type ReactNode } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { slideListCopy } from "@/copy/slide-list-copy"
import { EditorMenuRule } from "@/editor/editor-menu"
import type { SlideKey } from "@/editor/slide-keys"

const keys: Record<SlideKey, { readonly label: string; readonly shown: string; readonly shortcuts: string }> = {
  clone: { label: slideListCopy.duplicate, shown: slideListCopy.duplicateKey, shortcuts: "Control+D Meta+D" },
  remove: { label: slideListCopy.delete, shown: slideListCopy.deleteKey, shortcuts: "Delete Backspace" },
  up: {
    label: slideListCopy.moveUp,
    shown: slideListCopy.moveUpKey,
    shortcuts: "Control+BracketLeft Meta+BracketLeft",
  },
  down: {
    label: slideListCopy.moveDown,
    shown: slideListCopy.moveDownKey,
    shortcuts: "Control+BracketRight Meta+BracketRight",
  },
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

export type SlideMenuAnchor = ComponentProps<typeof DropdownMenuContent>["anchor"]

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
  pointer = false,
  onOpen,
  children,
}: {
  anchor: SlideMenuAnchor
  index: number
  count: number
  open: boolean
  onOpenChange: (open: boolean, keyboard: boolean) => void
  onChoose: (change: SlideKey) => void
  skipped: boolean
  onSkip: ((skipped: boolean) => void) | undefined
  set?: SlideMenuSet | undefined
  pointer?: boolean
  onOpen?: () => void
  children?: ReactNode
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
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(next, details) =>
        onOpenChange(
          next,
          details.reason === "escape-key" ||
            (details.reason === "item-press" && !(details.event instanceof MouseEvent && details.event.detail > 0)),
        )
      }
    >
      <DropdownMenuContent
        anchor={anchor}
        finalFocus={false}
        side={pointer ? "bottom" : "right"}
        align="start"
        sideOffset={pointer ? 2 : 8}
        variant="editor"
        className="flex w-max min-w-47 flex-col"
      >
        {onOpen === undefined ? null : (
          <DropdownMenuItem
            disabled={set !== undefined && set.size > 1}
            aria-keyshortcuts={slideListCopy.openKey}
            variant="editor"
            className="gap-5.5"
            onClick={onOpen}
          >
            <span className="min-w-0 flex-1">{slideListCopy.open}</span>
            <span className="text-xs text-[var(--shortcut)]">{slideListCopy.openKey}</span>
          </DropdownMenuItem>
        )}
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
        {children === undefined ? null : (
          <>
            <EditorMenuRule />
            {children}
          </>
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
      variant="editor"
      className="gap-5.5"
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
    <DropdownMenuItem variant="editor" className="gap-5.5" onClick={() => onSkip(!skipped)}>
      {count === 1 ? single : set(count)}
    </DropdownMenuItem>
  )
}
