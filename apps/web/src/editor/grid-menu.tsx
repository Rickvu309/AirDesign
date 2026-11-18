import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { slideListCopy } from "@/copy/slide-list-copy"
import { gridMoveAt, type GridCommand } from "@/editor/editor-grid-keys"
import { EditorMenuContent } from "@/editor/editor-menu"
import type { SlideKey } from "@/editor/slide-keys"
import { slideMenuItem, SlideMenuRows } from "@/editor/slide-menu"

export type MenuAnchor = { readonly getBoundingClientRect: () => DOMRect }

export type GridMenu = { readonly index: number; readonly anchor: MenuAnchor; readonly pointer: boolean }

const gridChange: Record<SlideKey, GridCommand> = { clone: "clone", remove: "remove", up: "earlier", down: "later" }

export function pointAt(x: number, y: number): MenuAnchor {
  return { getBoundingClientRect: () => new DOMRect(x, y, 0, 0) }
}

export function GridSlideMenu({
  menu,
  count,
  held,
  canMoveSet,
  canChangeSet,
  onAct,
  onClose,
}: {
  menu: GridMenu
  count: number
  held: readonly number[]
  canMoveSet: boolean
  canChangeSet: boolean
  onAct: (command: GridCommand, index: number) => void
  onClose: () => void
}) {
  const multiple = held.length > 1
  const allowed = (change: SlideKey) => {
    if (change === "clone" || change === "remove") return canChangeSet
    return canMoveSet && gridMoveAt(held, count, change === "up" ? "earlier" : "later") !== null
  }
  return (
    <DropdownMenu
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <EditorMenuContent
        {...(multiple ? { className: "w-56" } : {})}
        anchor={menu.anchor}
        side={menu.pointer ? "bottom" : "right"}
        align="start"
        sideOffset={menu.pointer ? 2 : 8}
      >
        <DropdownMenuItem
          disabled={multiple}
          aria-keyshortcuts="Enter"
          className={slideMenuItem}
          onClick={() => onAct("open", menu.index)}
        >
          <span className="min-w-0 flex-1">{slideListCopy.open}</span>
          <span className="text-xs text-[var(--shortcut)]">{slideListCopy.openKey}</span>
        </DropdownMenuItem>
        <SlideMenuRows
          index={menu.index}
          count={count}
          onChoose={(change) => onAct(gridChange[change], menu.index)}
          {...(!multiple ? {} : { allowed, labels: slideListCopy.setActions(held.length) })}
        />
      </EditorMenuContent>
    </DropdownMenu>
  )
}
