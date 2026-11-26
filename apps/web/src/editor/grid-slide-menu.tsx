import { limits } from "@airdesign/doom"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { slideListCopy } from "@/copy/slide-list-copy"
import { SlideMenu } from "@/editor/slide-menu"
import type { SlideStrip } from "@/editor/slide-sidebar"
import type { GridMenu, useGridSlideActions } from "@/editor/use-grid-slide-actions"

export function GridSlideMenu({
  menu,
  actions,
  strip,
  count,
  onOpen,
}: {
  readonly menu: GridMenu
  readonly actions: ReturnType<typeof useGridSlideActions>
  readonly strip: SlideStrip
  readonly count: number
  readonly onOpen: (index: number) => void
}) {
  return (
    <SlideMenu
      open
      anchor={menu.anchor}
      pointer={menu.pointer}
      index={menu.index}
      count={count}
      onOpenChange={(next, keyboard) => {
        if (!next) actions.closeMenu(keyboard)
      }}
      onChoose={(change) => actions.act(change, menu.index)}
      skipped={strip.skipped?.[menu.index] === true}
      onSkip={strip.onSkip === undefined ? undefined : (skipped) => strip.onSkip?.(actions.menuHeld, skipped)}
      set={actions.menuSet}
      onOpen={() => onOpen(menu.index)}
    >
      {strip.onAdd === undefined
        ? null
        : (["same", "new"] as const).map((side) => (
            <DropdownMenuItem
              key={side}
              disabled={actions.full}
              aria-description={actions.full ? slideListCopy.slideLimit(limits.slides) : undefined}
              variant="editor"
              className="gap-5.5"
              onClick={() => actions.add(menu.index, side)}
            >
              {side === "same" ? slideListCopy.addAfterMenu : slideListCopy.addBelowMenu}
            </DropdownMenuItem>
          ))}
      {strip.onMoveGroups === undefined ? null : (
        <DropdownMenuItem
          disabled={!actions.canMoveBelow}
          variant="editor"
          className="gap-5.5"
          onClick={actions.moveBelow}
        >
          {slideListCopy.moveBelowMenu}
        </DropdownMenuItem>
      )}
    </SlideMenu>
  )
}
