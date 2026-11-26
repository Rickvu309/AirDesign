import * as doom from "@airdesign/doom"
import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react"
import { carryStep, dropWrites, liftOf, type CarryStep } from "./canvas-carry"
import type { CanvasGesture, Moving } from "./canvas-gesture"
import { axisLocked } from "./move-writes"
import type { Point } from "./slide-geometry"
import { reachOf } from "./snapping"
import type { PointerArgs } from "./use-canvas-pointer"

type Pointed = PointerEvent | ReactPointerEvent

export function useLayerCarry({
  latest,
  active,
  toSlide,
  screenScale,
  advance,
  copied,
}: {
  readonly latest: RefObject<PointerArgs>
  readonly active: RefObject<CanvasGesture | null>
  readonly toSlide: (event: Pointed) => Point
  readonly screenScale: () => number
  readonly advance: (event: Pointed) => void
  readonly copied: (gesture: Moving, copies: doom.Copies | null) => void
}) {
  const edging = useRef(0)
  const lastMove = useRef<Pointed | null>(null)
  useEffect(() => () => cancelAnimationFrame(edging.current), [])

  function stepAt(gesture: Moving, event: Pointed): CarryStep | null {
    const a = latest.current
    const at = toSlide(event)
    const over = a.carry?.over(at)
    if (over === undefined || over.kind === "home") return null
    const copies = event.altKey
      ? (gesture.copies ??= doom.duplicateWrites(gesture.view, gesture.ids, a.client.mint))
      : null
    copied(gesture, copies)
    if (gesture.lifted?.copies !== copies)
      gesture.lifted = { copies, lift: liftOf(gesture.view, gesture.geometry, gesture.ids, a.slide, copies) }
    return carryStep({
      over,
      lift: gesture.lifted.lift,
      by: axisLocked({ x: at.x - gesture.origin.x, y: at.y - gesture.origin.y }, event.shiftKey),
      snap: !event.ctrlKey,
      reach: reachOf(a.size.w * screenScale(), a.size.w),
      size: a.size,
    })
  }

  function edge() {
    edging.current = requestAnimationFrame(() => {
      const gesture = active.current
      const carry = latest.current.carry
      const last = lastMove.current
      if (gesture?.kind !== "move" || carry === undefined) return
      if (last !== null && gesture.moved && carry.edge({ x: last.clientX, y: last.clientY })) advance(last)
      edge()
    })
  }

  return {
    show(gesture: Moving, event: Pointed): boolean {
      const a = latest.current
      const step = stepAt(gesture, event)
      const over = step === null ? undefined : step.over
      if (over !== gesture.over) a.carry?.onCarry(over)
      gesture.over = over
      a.setFlight(step?.flight ?? null)
      if (step === null) return false
      a.setPreview(step.lift?.preview ?? null)
      return true
    },
    drop(gesture: Moving, event: Pointed): boolean {
      const a = latest.current
      const step = stepAt(gesture, event)
      if (step === null) return false
      const { lift, drop } = step
      const writes = lift === null || drop === null ? null : dropWrites(a.view, lift, drop.slide, drop.at)
      if (lift !== null && drop !== null && writes !== null && a.client.push(writes).ok)
        a.carry?.landed(drop.slide, lift.roots)
      else if (gesture.copying) a.onSelection(gesture.selected)
      return true
    },
    begin() {
      lastMove.current = null
      if (latest.current.carry !== undefined) edge()
    },
    track(event: Pointed) {
      lastMove.current = event
    },
    stop() {
      cancelAnimationFrame(edging.current)
      lastMove.current = null
    },
  }
}
