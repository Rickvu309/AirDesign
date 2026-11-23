import { limits } from "@airdesign/doom"
import { useLayoutEffect, useRef, useState, type RefObject } from "react"
import { slideListCopy } from "@/copy/slide-list-copy"
import { gridDrop, gridGroups, gridMoveMessage } from "@/editor/grid-drop"
import {
  heldOf,
  heldSlides,
  livePick,
  pressedPick,
  setStepOf,
  turnedPick,
  type HeldSlides,
  type SetStep,
  type SlidePress,
} from "@/editor/slide-list-pick"
import type { SlideKey } from "@/editor/slide-keys"
import type { SlideMenuSet } from "@/editor/slide-menu"
import { setMoveAt, slideSetAction } from "@/editor/slide-set-actions"
import type { SlideStrip } from "@/editor/slide-sidebar"

export function useSlideListSet(
  strip: SlideStrip,
  {
    following,
    list,
    announce,
    onSlideSelection,
  }: {
    following: RefObject<boolean>
    list: RefObject<HTMLElement | null>
    announce: (text: string) => void
    onSlideSelection: ((count: number) => void) | undefined
  },
) {
  const [picked, setPicked] = useState<HeldSlides>(null)
  const ids = strip.slideIds
  const live = livePick(picked, strip.current, ids)
  const held = heldSlides(live, strip.current)
  const heldKey = held.join(",")
  const onSelection = strip.onSelection
  useLayoutEffect(() => {
    const slides = heldKey.split(",").map(Number)
    onSelection?.(slides)
    onSlideSelection?.(slides.length)
  }, [onSelection, onSlideSelection, heldKey])
  const step = useRef<SetStep | null>(null)
  useLayoutEffect(() => {
    if (step.current === null) return
    const turn = turnedPick(step.current, ids)
    step.current = turn.step
    const turned = turn.at
    if (turned === null) return
    setPicked(turned.pick)
    const at = turned.current === undefined ? -1 : ids.findIndex((id) => id === turned.current)
    if (at === -1) return
    if (list.current?.contains(document.activeElement) === true) following.current = true
    strip.onSelect(at)
  })
  const press = (index: number, how: SlidePress) => {
    step.current = null
    const next = pressedPick(live, index, strip.current, how)
    setPicked(heldOf(next.pick, ids))
    if (next.pick !== null && how !== "menu") announce(slideListCopy.selected(next.pick.slides.size))
    strip.onSelect(next.current)
  }
  const moveSlides = (moved: readonly number[], at: number) => {
    step.current = null
    const first = gridDrop(gridGroups(strip), moved, at)
    if (first === null || strip.onMoveMany === undefined) return
    following.current = true
    strip.onMoveMany(moved, at)
    setPicked(moved.length > 1 ? heldOf({ anchor: moved[0] ?? first, slides: new Set(moved) }, ids) : null)
    announce(gridMoveMessage(moved, at))
  }
  const actOnSet = slideSetAction(strip, held, {
    follow: () => {
      following.current = true
    },
    pick: (slides, order) => {
      const [anchor] = slides
      const made = anchor === undefined ? null : { anchor, slides: new Set(slides) }
      step.current = setStepOf(
        ids,
        order,
        { pick: heldOf(live, ids), current: ids[strip.current] },
        { pick: made, current: anchor },
      )
      setPicked(made)
    },
    moveSlides,
    announce,
  })
  const inSet = (index: number) => live?.slides.has(index) === true
  const setChange = (index: number): ((change: SlideKey) => void) | null => (inSet(index) ? actOnSet : null)
  const menuSet: SlideMenuSet | undefined =
    live === null
      ? undefined
      : {
          size: held.length,
          skipped: held.every((index) => strip.skipped?.[index] === true),
          allowed: (change) => {
            if (change === "up" || change === "down")
              return strip.onMoveMany !== undefined && setMoveAt(held, strip.count, change) !== null
            if (strip.onChangeSet === undefined) return false
            return change === "remove" ? held.length < strip.count : held.length + strip.count <= limits.slides
          },
        }
  const drop = () => setPicked(null)
  return { held, press, moveSlides, inSet, setChange, menuSet, drop }
}
