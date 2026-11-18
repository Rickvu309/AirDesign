import { slideListCopy } from "@/copy/slide-list-copy"
import { gridMoveAt, type GridCommand } from "@/editor/editor-grid-keys"
import { pickedSlides, type GridPick } from "@/editor/grid-selection"
import type { SlideStrip } from "@/editor/slide-sidebar"

export function gridSlideActions(
  strip: SlideStrip,
  picked: GridPick,
  {
    follow,
    clearPick,
    open,
    moveSlides,
    announce,
  }: {
    follow: () => void
    clearPick: () => void
    open: (index: number) => void
    moveSlides: (held: readonly number[], at: number, row: boolean) => void
    announce: (text: string) => void
  },
) {
  const { current, count } = strip
  return function act(command: GridCommand, index: number) {
    const target = picked?.slides.size === 1 ? (pickedSlides(picked, current)[0] ?? index) : index
    if (picked?.slides.size === 1) clearPick()
    if (picked !== null && picked.slides.size > 1) {
      if (command === "earlier" || command === "later") {
        const held = pickedSlides(picked, current)
        const at = gridMoveAt(held, count, command)
        if (at !== null && strip.onMoveMany !== undefined) moveSlides(held, at, false)
      } else if (command !== "open") announce(slideListCopy.selectOne)
      return
    }
    if (command === "open") {
      open(target)
      return
    }
    if (command === "remove") {
      if (count < 2) return
      follow()
      strip.onRemove?.(target)
      announce(slideListCopy.deleted(target + 1))
      return
    }
    if (command === "clone") {
      follow()
      strip.onClone?.(target)
      announce(slideListCopy.duplicated(target + 1))
      return
    }
    if (command === "earlier" && target > 0) {
      follow()
      strip.onMove?.(target, target - 1)
      announce(slideListCopy.moved(target + 1, target))
    }
    if (command === "later" && target < count - 1) {
      follow()
      strip.onMove?.(target, target + 1)
      announce(slideListCopy.moved(target + 1, target + 2))
    }
  }
}
