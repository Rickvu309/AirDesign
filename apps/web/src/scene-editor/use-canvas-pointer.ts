import type { scene } from "@airdesign/document"
import type { TransformGrip } from "@airdesign/render"
import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react"
import type { Preview } from "./canvas-overlay"
import { hitChain } from "./hit-test"
import { movedBy } from "./move-writes"
import { lockedIn } from "./node-props"
import {
  marqueeSelection,
  noSelection,
  picked,
  rectBetween,
  steppedIn,
  unitOf,
  type Rect,
  type Selection,
} from "./selection"
import type { Point, SlideGeometry } from "./slide-geometry"
import { transformedBy } from "./transform-drag"
import type { EditorClient } from "./use-scene-deck"

export type Tool = "move" | "hand"

export type PointerArgs = {
  readonly stage: RefObject<HTMLDivElement | null>
  readonly slideBox: RefObject<HTMLDivElement | null>
  readonly client: EditorClient
  readonly view: scene.Scene
  readonly geometry: SlideGeometry
  readonly selection: Selection
  readonly onSelection: (next: Selection) => void
  readonly scale: number
  readonly size: { readonly w: number; readonly h: number }
  readonly panning: boolean
  readonly setPreview: (preview: Preview | null) => void
  readonly setMarquee: (rect: Rect | null) => void
  readonly setHover: (id: scene.NodeId | null) => void
}

type Active =
  | { readonly kind: "pan"; readonly x: number; readonly y: number; readonly left: number; readonly top: number }
  | {
      readonly kind: "move"
      readonly origin: Point
      readonly ids: readonly scene.NodeId[]
      readonly view: scene.Scene
      readonly geometry: SlideGeometry
      readonly alone: Selection | null
      moved: boolean
    }
  | {
      readonly kind: "transform"
      readonly grip: TransformGrip
      readonly origin: Point
      readonly ids: readonly scene.NodeId[]
      readonly view: scene.Scene
      readonly geometry: SlideGeometry
      moved: boolean
    }
  | {
      readonly kind: "marquee"
      readonly origin: Point
      readonly base: readonly scene.NodeId[]
      readonly geometry: SlideGeometry
      readonly view: scene.Scene
      moved: boolean
    }

const threshold = 3

function gripOf(target: EventTarget | null): TransformGrip | null {
  const found = target instanceof Element ? target.closest("[data-grip]")?.getAttribute("data-grip") : null
  return found === null || found === undefined ? null : (found as TransformGrip)
}

export function useCanvasPointer(args: PointerArgs) {
  const latest = useRef(args)
  useEffect(() => {
    latest.current = args
  })
  const active = useRef<Active | null>(null)
  const pending = useRef<PointerEvent | ReactPointerEvent | null>(null)
  const frame = useRef(0)

  const toSlide = (event: { readonly clientX: number; readonly clientY: number }): Point => {
    const box = latest.current.slideBox.current?.getBoundingClientRect()
    const { scale } = latest.current
    return box === undefined
      ? { x: 0, y: 0 }
      : { x: (event.clientX - box.left) / scale, y: (event.clientY - box.top) / scale }
  }

  const chainAt = (
    event: { readonly clientX: number; readonly clientY: number },
    geometry: SlideGeometry,
    view: scene.Scene,
  ) => hitChain(geometry.roots, toSlide(event), 4.5 / latest.current.scale, (id) => lockedIn(view, id))

  type Evaluated = Pick<Preview, "writes" | "guides" | "label">

  function evaluate(
    gesture: Extract<Active, { kind: "move" | "transform" }>,
    event: PointerEvent | ReactPointerEvent,
  ): Evaluated {
    const a = latest.current
    const at = toSlide(event)
    if (gesture.kind === "move") {
      const moved = movedBy({
        view: gesture.view,
        geometry: gesture.geometry,
        ids: gesture.ids,
        by: { x: at.x - gesture.origin.x, y: at.y - gesture.origin.y },
        snap: !event.ctrlKey,
        lockAxis: event.shiftKey,
        scale: a.scale,
        size: a.size,
      })
      return { writes: moved.writes, guides: moved.guides, label: null }
    }
    return transformedBy({
      view: gesture.view,
      geometry: gesture.geometry,
      ids: gesture.ids,
      grip: gesture.grip,
      origin: gesture.origin,
      at,
      keepRatio: event.shiftKey,
      fromCenter: event.altKey,
      snapAngle: event.shiftKey,
      snap: !event.ctrlKey,
      scale: a.scale,
      size: a.size,
    })
  }

  function advance(event: PointerEvent | ReactPointerEvent) {
    const gesture = active.current
    const a = latest.current
    if (gesture === null) return
    if (gesture.kind === "pan") {
      const stage = a.stage.current
      if (stage === null) return
      stage.scrollLeft = gesture.left - (event.clientX - gesture.x)
      stage.scrollTop = gesture.top - (event.clientY - gesture.y)
      return
    }
    const at = toSlide(event)
    const far = Math.hypot(at.x - gesture.origin.x, at.y - gesture.origin.y) * a.scale >= threshold
    if (!gesture.moved && !far) return
    gesture.moved = true
    if (gesture.kind === "move" || gesture.kind === "transform") {
      const done = evaluate(gesture, event)
      a.setPreview(done.writes.length === 0 ? null : { ...done, kind: gesture.kind })
      return
    }
    const rect = rectBetween(gesture.origin, at)
    a.setMarquee(rect)
    const hits = marqueeSelection(gesture.geometry, rect, {
      deep: event.metaKey || event.ctrlKey,
      locked: (id) => lockedIn(gesture.view, id),
    })
    a.onSelection({ ids: [...new Set([...gesture.base, ...hits])], inside: null })
  }

  function schedule(event: PointerEvent | ReactPointerEvent) {
    pending.current = event
    if (frame.current !== 0) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const next = pending.current
      pending.current = null
      if (next !== null) advance(next)
    })
  }

  function finish(commit: boolean, last: PointerEvent | ReactPointerEvent | null) {
    const gesture = active.current
    const a = latest.current
    active.current = null
    if (frame.current !== 0) {
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
    pending.current = null
    a.setMarquee(null)
    a.setPreview(null)
    if (gesture === null || (gesture.kind !== "move" && gesture.kind !== "transform") || !commit || last === null)
      return
    const at = toSlide(last)
    const by = { x: at.x - gesture.origin.x, y: at.y - gesture.origin.y }
    if (!gesture.moved && Math.hypot(by.x, by.y) * a.scale < threshold) {
      if (gesture.kind === "move" && gesture.alone !== null) a.onSelection(gesture.alone)
      return
    }
    const done = evaluate(gesture, last)
    if (done.writes.length > 0) a.client.push(done.writes)
  }

  return {
    down(event: ReactPointerEvent<HTMLElement>) {
      const a = latest.current
      if (event.button !== 0 && event.button !== 1) return
      const stage = a.stage.current
      if (stage === null) return
      stage.setPointerCapture(event.pointerId)
      if (a.panning || event.button === 1) {
        active.current = {
          kind: "pan",
          x: event.clientX,
          y: event.clientY,
          left: stage.scrollLeft,
          top: stage.scrollTop,
        }
        return
      }
      const origin = toSlide(event)
      const grip = gripOf(event.target)
      if (grip !== null) {
        active.current = {
          kind: "transform",
          grip,
          origin,
          ids: a.selection.ids,
          view: a.view,
          geometry: a.geometry,
          moved: false,
        }
        return
      }
      const chain = chainAt(event, a.geometry, a.view)
      const deep = event.metaKey || event.ctrlKey
      if (chain === null) {
        const base = event.shiftKey ? a.selection.ids : []
        if (!event.shiftKey) a.onSelection(noSelection)
        active.current = { kind: "marquee", origin, base, geometry: a.geometry, view: a.view, moved: false }
        return
      }
      const unit = unitOf(chain, a.selection.inside, deep)
      const held = a.selection.ids.includes(unit.id) && !event.shiftKey
      const next = held ? a.selection : picked(chain, a.selection, { shift: event.shiftKey, deep })
      if (!held) a.onSelection(next)
      const alone = held && a.selection.ids.length > 1 ? picked(chain, a.selection, { shift: false, deep }) : null
      active.current = { kind: "move", origin, ids: next.ids, view: a.view, geometry: a.geometry, alone, moved: false }
    },
    double(event: ReactMouseEvent<HTMLElement>) {
      const a = latest.current
      const chain = chainAt(event, a.geometry, a.view)
      if (chain === null) return
      const inside = steppedIn(chain, a.selection)
      if (inside !== null) a.onSelection(inside)
    },
    move(event: ReactPointerEvent<HTMLElement>) {
      const a = latest.current
      if (active.current !== null) {
        schedule(event)
        return
      }
      if (a.panning) return
      const chain = chainAt(event, a.geometry, a.view)
      a.setHover(chain === null ? null : unitOf(chain, a.selection.inside, event.metaKey || event.ctrlKey).id)
    },
    up(event: ReactPointerEvent<HTMLElement>) {
      const stage = latest.current.stage.current
      if (stage?.hasPointerCapture(event.pointerId) === true) stage.releasePointerCapture(event.pointerId)
      finish(true, event)
    },
    cancel() {
      finish(false, null)
    },
    leave() {
      latest.current.setHover(null)
    },
    cancelDrag() {
      const had = active.current !== null
      finish(false, null)
      return had
    },
  }
}
