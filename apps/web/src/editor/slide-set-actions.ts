import { limits } from "@airdesign/doom"
import { toast } from "@/components/ui/toast"
import { slideListCopy } from "@/copy/slide-list-copy"
import type { SlideKey } from "@/editor/slide-keys"
import type { SlideStrip } from "@/editor/slide-sidebar"

export function setMoveAt(held: readonly number[], count: number, change: "up" | "down"): number | null {
  const first = held[0]
  const last = held.at(-1)
  if (first === undefined || last === undefined) return null
  if (change === "up") return first > 0 ? first - 1 : null
  return last < count - 1 ? last + 2 : null
}

export function slideSetAction(
  strip: SlideStrip,
  held: readonly number[],
  {
    follow,
    pick,
    moveSlides,
    announce,
  }: {
    follow: () => void
    pick: (slides: readonly string[], order: readonly string[]) => void
    moveSlides: (held: readonly number[], at: number) => void
    announce: (text: string) => void
  },
) {
  return function act(change: SlideKey) {
    if (change === "up" || change === "down") {
      const at = setMoveAt(held, strip.count, change)
      if (at !== null) moveSlides(held, at)
      return
    }
    if (change === "clone" && held.length + strip.count > limits.slides) {
      toast.error(slideListCopy.slideLimit(limits.slides))
      return
    }
    const result = strip.onChangeSet?.(change, held)
    if (result === undefined || result === null) return
    const picked = result.picked
    follow()
    pick(picked, result.order)
    announce(change === "clone" ? slideListCopy.duplicatedSet(picked.length) : slideListCopy.deletedSet(held.length))
  }
}
