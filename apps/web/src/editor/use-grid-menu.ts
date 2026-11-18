import { useState, type RefObject } from "react"
import type { GridMoveSide, GridRange } from "@/editor/grid-drop"
import type { GridStep } from "@/editor/grid-interaction"
import type { GridMenu, MenuAnchor } from "@/editor/grid-menu"
import { pickedSlides, type GridPick } from "@/editor/grid-selection"

export function useGridMenu({
  list,
  rows,
  picked,
  selected,
  step,
  onSelect,
  onStop,
  moveSlides,
}: {
  list: RefObject<HTMLDivElement | null>
  rows: readonly GridRange[]
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

  function close() {
    const shown = menu
    setMenu(null)
    if (shown === null) return
    list.current?.querySelector<HTMLElement>(`[data-slide-entry="${shown.index + 1}"]`)?.focus()
  }

  function moveBelow() {
    if (menu === null) return
    const row = rows.find(({ start, end }) => start <= menu.index && menu.index < end)
    if (row !== undefined) moveSlides(pickedSlides(picked, menu.index), row.end, "new")
  }

  return { menu, open, close, moveBelow }
}
