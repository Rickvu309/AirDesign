import { limits } from "@airdesign/document"
import { toast } from "@/components/ui/toast"
import { slideListCopy } from "@/copy/slide-list-copy"
import { gridMoveAt, type GridCommand } from "@/editor/editor-grid-keys"
import { pickedSlides, type GridPick } from "@/editor/grid-selection"
import type { SlideStrip } from "@/editor/slide-sidebar"

export function gridSlideActions(
  strip: SlideStrip,
  picked: GridPick,
  {
    follow,
    pick,
    open,
    moveSlides,
    announce,
  }: {
    follow: () => void
    pick: (pick: GridPick) => void
    open: (index: number) => void
    moveSlides: (held: readonly number[], at: number, row: boolean) => void
    announce: (text: string) => void
  },
) {
  const { current, count } = strip
  return function act(command: GridCommand, index: number) {
    const target = picked?.slides.size === 1 ? (pickedSlides(picked, current)[0] ?? index) : index
    if (picked?.slides.size === 1) pick(null)
    if (picked !== null && picked.slides.size > 1) {
      const held = pickedSlides(picked, current)
      if (command === "earlier" || command === "later") {
        const at = gridMoveAt(held, count, command)
        if (at !== null && strip.onMoveMany !== undefined) moveSlides(held, at, false)
      } else if (command !== "open") {
        if (command === "remove" && held.length >= count) toast.error(slideListCopy.lastSlide)
        else if (command === "clone" && held.length + count > limits.slides)
          toast.error(slideListCopy.slideLimit(limits.slides))
        else
          strip.onChangeSet?.(command, held, (copies) => {
            follow()
            const anchor = copies[0]?.index
            pick(
              anchor === undefined
                ? null
                : {
                    anchor,
                    slides: new Set(copies.map((copy) => copy.index)),
                    copies: new Set(copies.map((copy) => copy.id)),
                  },
            )
            announce(
              command === "clone" ? slideListCopy.duplicatedSet(copies.length) : slideListCopy.deletedSet(held.length),
            )
          })
      }
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
