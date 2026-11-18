import { limits, type GridSide } from "@airdesign/document"
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { slideListCopy } from "@/copy/slide-list-copy"
import { gridMoveAt, type GridCommand } from "@/editor/editor-grid-keys"
import { EditorMenuContent, EditorMenuRule } from "@/editor/editor-menu"
import type { SlideKey } from "@/editor/slide-keys"
import { slideChangeAllowed, slideMenuItem, SlideMenuRows, SlideSkipItem } from "@/editor/slide-menu"

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
  canAdd,
  onAdd,
  onMoveBelow,
  onAct,
  onClose,
  skipped,
  onSkip,
}: {
  menu: GridMenu
  count: number
  held: readonly number[]
  canMoveSet: boolean
  canChangeSet: boolean
  canAdd: boolean
  onAdd: (side: GridSide) => void
  onMoveBelow: () => void
  onAct: (command: GridCommand, index: number) => void
  onClose: () => void
  skipped: readonly boolean[] | undefined
  onSkip: ((indices: readonly number[], skipped: boolean) => void) | undefined
}) {
  const multiple = held.length > 1
  const allowed = (change: SlideKey) => {
    if (!multiple) return change === "remove" || slideChangeAllowed(change, menu.index, count)
    if (change === "clone" || change === "remove") return canChangeSet
    return canMoveSet && gridMoveAt(held, count, change === "up" ? "earlier" : "later") !== null
  }
  const full = count >= limits.slides
  return (
    <DropdownMenu
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <EditorMenuContent
        className="w-60"
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
          allowed={allowed}
          {...(!multiple ? {} : { labels: slideListCopy.setActions(held.length) })}
        />
        {onSkip === undefined ? null : (
          <SlideSkipItem
            count={held.length}
            skipped={held.every((index) => skipped?.[index] === true)}
            onSkip={(next) => onSkip(held, next)}
          />
        )}
        {canAdd || canMoveSet ? <EditorMenuRule /> : null}
        {canAdd
          ? (["same", "new"] as const).map((side) => (
              <DropdownMenuItem
                key={side}
                disabled={full}
                title={full ? slideListCopy.addLimit(limits.slides) : undefined}
                aria-description={full ? slideListCopy.addLimit(limits.slides) : undefined}
                className={slideMenuItem}
                onClick={() => onAdd(side)}
              >
                {side === "same" ? slideListCopy.addAfterMenu : slideListCopy.addBelowMenu}
              </DropdownMenuItem>
            ))
          : null}
        {canMoveSet ? (
          <DropdownMenuItem className={slideMenuItem} onClick={onMoveBelow}>
            {slideListCopy.moveBelowMenu}
          </DropdownMenuItem>
        ) : null}
      </EditorMenuContent>
    </DropdownMenu>
  )
}
