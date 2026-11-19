import { useState, type RefObject } from "react"
import { moveBelowPlace, type GridMoveSide, type GridRange } from "@/editor/grid-drop"
import type { GridStep } from "@/editor/grid-interaction"
import type { GridMenu, MenuAnchor } from "@/editor/grid-menu"
import { pickedSlides, type GridPick } from "@/editor/grid-selection"

export function useGridMenu({
  list,
  groups,
  picked,
  selected,
  step,
  onSelect,
  onStop,
  moveSlides,
}: {
  list: RefObject<HTMLDivElement | null>
  groups: readonly GridRange[]
  picked: GridPick
  selected: ReadonlySet<number>
  step: (next: GridStep) => void
  onSelect: (index: number) => void
  onStop: (index: number) => void
  moveSlides: (held: readonly number[], at: number, side: GridMoveSide) => void
}) {
  const [menu, setMenu] = useState<GridMenu | null>(null)

  function open(index: number, anchor: MenuAnchor, pointer: boolean) {
    if (!selected.has(index)) {
      step({ kind: "pick", pick: null })
      onSelect(index)
    }
    onStop(index)
    setMenu({ index, anchor, pointer })
  }

  function close(keyboard: boolean) {
    const shown = menu
    setMenu(null)
    if (shown === null) return
    list.current
      ?.querySelector<HTMLElement>(`[data-slide-entry="${shown.index + 1}"]`)
      ?.focus({ preventScroll: true, focusVisible: keyboard })
  }

  const below = menu === null ? null : moveBelowPlace(groups, pickedSlides(picked, menu.index), menu.index)

  function moveBelow() {
    if (menu !== null && below !== null) moveSlides(pickedSlides(picked, menu.index), below, "new")
  }

  return { menu, open, close, moveBelow, canMoveBelow: below !== null, dismiss: () => setMenu(null) }
}
