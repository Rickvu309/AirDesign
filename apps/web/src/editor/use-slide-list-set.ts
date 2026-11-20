import { useLayoutEffect, useState, type RefObject } from "react"
import { slideListCopy } from "@/copy/slide-list-copy"
import { gridMoveAt } from "@/editor/editor-grid-keys"
import { gridGroups } from "@/editor/grid-group"
import { gridDrop, type GridMoveSide } from "@/editor/grid-drop"
import { gridMoveMessage } from "@/editor/grid-group-frame"
import { gridChange } from "@/editor/grid-menu"
import type { GridPick } from "@/editor/grid-selection"
import { gridSlideActions } from "@/editor/grid-slide-actions"
import { heldSlides, livePick, pressedPick, type SlidePress } from "@/editor/slide-list-pick"
import type { SlideKey } from "@/editor/slide-keys"
import type { SlideMenuSet } from "@/editor/slide-menu"
import type { SlideStrip } from "@/editor/slide-sidebar"

const setDirection: Readonly<Record<"up" | "down", "earlier" | "later">> = { up: "earlier", down: "later" }

export function useSlideListSet(
  strip: SlideStrip,
  {
    following,
    announce,
    onSlideSelection,
  }: {
    following: RefObject<boolean>
    announce: (text: string) => void
    onSlideSelection: ((count: number) => void) | undefined
  },
) {
  const [picked, setPicked] = useState<GridPick>(null)
  const live = livePick(picked, strip.current, strip.count, strip.slideIds)
  const held = heldSlides(live, strip.current)
  const heldKey = held.join(",")
  const onSelection = strip.onSelection
  useLayoutEffect(() => {
    const slides = heldKey.split(",").map(Number)
    onSelection?.(slides)
    onSlideSelection?.(slides.length)
  }, [onSelection, onSlideSelection, heldKey])
  const press = (index: number, how: SlidePress) => {
    const next = pressedPick(live, index, strip.current, how)
    setPicked(next.pick)
    if (next.pick !== null && how !== "menu") announce(slideListCopy.selected(next.pick.slides.size))
    strip.onSelect(next.current)
  }
  const moveSlides = (moved: readonly number[], at: number, side: GridMoveSide) => {
    const groupRanges = gridGroups(strip)
    const first = gridDrop(groupRanges, moved, at, side)
    if (first === null || strip.onMoveMany === undefined) return
    following.current = true
    strip.onMoveMany(moved, at, side)
    setPicked(moved.length > 1 ? { anchor: first, slides: new Set(moved.map((_, offset) => first + offset)) } : null)
    announce(gridMoveMessage(groupRanges, moved, at, false))
  }
  const actOnSet = gridSlideActions(strip, live, {
    follow: () => {
      following.current = true
    },
    pick: setPicked,
    open: strip.onSelect,
    moveSlides,
    announce,
  })
  const inSet = (index: number) => live?.slides.has(index) === true
  const setChange = (index: number): ((change: SlideKey) => void) | null =>
    inSet(index) ? (change) => actOnSet(gridChange[change], index) : null
  const menuSet: SlideMenuSet | undefined =
    live === null
      ? undefined
      : {
          size: held.length,
          skipped: held.every((index) => strip.skipped?.[index] === true),
          allowed: (change) => {
            if (change === "clone" || change === "remove") return strip.onChangeSet !== undefined
            return strip.onMoveMany !== undefined && gridMoveAt(held, strip.count, setDirection[change]) !== null
          },
        }
  const drop = () => setPicked(null)
  return { held, press, moveSlides, inSet, setChange, menuSet, drop }
}
