import * as doom from "@airdesign/doom"
import type { TransformGrip } from "./transform-math"
import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react"
import type { Preview } from "./canvas-overlay"
import { hitChain } from "./hit-test"
import { isEndGrip, lineEndDrag, type EndGrip } from "./line-end-drag"
import { movedBy } from "./move-writes"
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
import type { Placed, Point, SlideGeometry } from "./slide-geometry"
import { transformedBy } from "./transform-drag"
import type { EditorClient } from "./use-doom-deck"

import type { Drawn } from "./create-writes"

export type Tool = "move" | "hand" | "text" | Drawn

const drawing: readonly Tool[] = ["text", "frame", "rectangle", "ellipse", "line", "arrow"]

export type DrawRequest = {
  readonly from: Point
  readonly to: Point | null
  readonly chain: readonly Placed[] | null
  readonly shift: boolean
  readonly alt: boolean
  readonly commit: boolean
}

export type PointerArgs = {
  readonly stage: RefObject<HTMLDivElement | null>
  readonly slideBox: RefObject<HTMLDivElement | null>
  readonly client: EditorClient
  readonly view: doom.Doom
  readonly geometry: SlideGeometry
  readonly selection: Selection
  readonly onSelection: (next: Selection) => void
  readonly scale: number
  readonly size: { readonly w: number; readonly h: number }
  readonly panning: boolean
  readonly texting: boolean
  readonly onTextEnd: () => void
  readonly onTextEdit: (id: doom.NodeId, at: { readonly x: number; readonly y: number }) => void
  readonly onDraw: (request: DrawRequest) => readonly doom.Write[] | null
  readonly tool: Tool
  readonly setPreview: (preview: Preview | null) => void
  readonly setMarquee: (rect: Rect | null) => void
  readonly setHover: (id: doom.NodeId | null) => void
}

type Active =
  | { readonly kind: "pan"; readonly x: number; readonly y: number; readonly left: number; readonly top: number }
  | {
      readonly kind: "move"
      readonly origin: Point
      readonly ids: readonly doom.NodeId[]
      readonly view: doom.Doom
      readonly geometry: SlideGeometry
      readonly alone: Selection | null
      readonly selected: Selection
      copies: doom.Copies | null
      copying: boolean
      moved: boolean
    }
  | {
      readonly kind: "transform"
      readonly grip: TransformGrip
      readonly origin: Point
      readonly ids: readonly doom.NodeId[]
      readonly view: doom.Doom
      readonly geometry: SlideGeometry
      moved: boolean
    }
  | {
      readonly kind: "end"
      readonly grip: EndGrip
      readonly origin: Point
      readonly line: doom.NodeId
      readonly view: doom.Doom
      readonly geometry: SlideGeometry
      moved: boolean
    }
  | {
      readonly kind: "draw"
      readonly origin: Point
      readonly chain: readonly Placed[] | null
      moved: boolean
    }
  | {
      readonly kind: "marquee"
      readonly origin: Point
      readonly base: readonly doom.NodeId[]
      readonly geometry: SlideGeometry
      readonly view: doom.Doom
      moved: boolean
    }

const threshold = 3

function inEditor(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-text-editor]") !== null
}

function gripOf(target: EventTarget | null): TransformGrip | EndGrip | null {
  const found = target instanceof Element ? target.closest("[data-grip]")?.getAttribute("data-grip") : null
  return found === null || found === undefined ? null : (found as TransformGrip | EndGrip)
}

export function useCanvasPointer(args: PointerArgs) {
  const latest = useRef(args)
  useEffect(() => {
    latest.current = args
  })
  useEffect(() => {
    const stage = latest.current.stage.current
    if (stage === null) return
    const leave = () => latest.current.setHover(null)
    stage.addEventListener("pointerleave", leave)
    return () => stage.removeEventListener("pointerleave", leave)
  }, [])
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
    view: doom.Doom,
  ) => hitChain(geometry.roots, toSlide(event), 4.5 / latest.current.scale, (id) => doom.lockedIn(view, id))

  type Evaluated = Pick<Preview, "writes" | "guides" | "label"> & { readonly copies: doom.Copies | null }

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
      if (!event.altKey) return { writes: moved.writes, guides: moved.guides, label: null, copies: null }
      gesture.copies ??= doom.duplicateWrites(gesture.view, gesture.ids, a.client.mint)
      return {
        writes: doom.copiedMove(gesture.copies, moved.writes),
        guides: moved.guides,
        label: null,
        copies: gesture.copies,
      }
    }
    const transformed = transformedBy({
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
    return { ...transformed, copies: null }
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
    if (gesture.kind === "end") {
      const done = lineEndDrag({
        view: gesture.view,
        geometry: gesture.geometry,
        line: gesture.line,
        grip: gesture.grip,
        at,
        snap: !event.ctrlKey,
        lockAngle: event.shiftKey,
        scale: a.scale,
      })
      a.setPreview({ kind: "end", writes: done.writes, guides: [], label: null, aim: done.aim })
      return
    }
    if (gesture.kind === "move" || gesture.kind === "transform") {
      const done = evaluate(gesture, event)
      if (gesture.kind === "move" && (done.copies !== null) !== gesture.copying) {
        gesture.copying = done.copies !== null
        a.onSelection(
          done.copies === null ? gesture.selected : { ids: done.copies.roots, inside: gesture.selected.inside },
        )
      }
      const { copies: _copies, ...preview } = done
      a.setPreview(done.writes.length === 0 ? null : { ...preview, kind: gesture.kind })
      return
    }
    if (gesture.kind === "draw") {
      if (a.tool === "text") {
        a.setMarquee(rectBetween(gesture.origin, at))
        return
      }
      const writes = a.onDraw({
        from: gesture.origin,
        to: at,
        chain: gesture.chain,
        shift: event.shiftKey,
        alt: event.altKey,
        commit: false,
      })
      a.setPreview(writes === null || writes.length === 0 ? null : { kind: "draw", writes, guides: [], label: null })
      return
    }
    const rect = rectBetween(gesture.origin, at)
    a.setMarquee(rect)
    const hits = marqueeSelection(gesture.geometry, rect, {
      deep: event.metaKey || event.ctrlKey,
      locked: (id) => doom.lockedIn(gesture.view, id),
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
    if (gesture?.kind === "draw" && commit && last !== null) {
      const at = toSlide(last)
      const far = gesture.moved || Math.hypot(at.x - gesture.origin.x, at.y - gesture.origin.y) * a.scale >= threshold
      a.onDraw({
        from: gesture.origin,
        to: far ? at : null,
        chain: gesture.chain,
        shift: last.shiftKey,
        alt: last.altKey,
        commit: true,
      })
      return
    }
    if (gesture?.kind === "end") {
      if (!commit || last === null || !gesture.moved) return
      const done = lineEndDrag({
        view: gesture.view,
        geometry: gesture.geometry,
        line: gesture.line,
        grip: gesture.grip,
        at: toSlide(last),
        snap: !last.ctrlKey,
        lockAngle: last.shiftKey,
        scale: a.scale,
      })
      a.client.push(done.writes)
      return
    }
    if (gesture?.kind === "move" && gesture.copying && !commit) a.onSelection(gesture.selected)
    if (gesture === null || (gesture.kind !== "move" && gesture.kind !== "transform") || !commit || last === null)
      return
    const at = toSlide(last)
    const by = { x: at.x - gesture.origin.x, y: at.y - gesture.origin.y }
    if (!gesture.moved && Math.hypot(by.x, by.y) * a.scale < threshold) {
      if (gesture.kind === "move" && gesture.alone !== null) a.onSelection(gesture.alone)
      return
    }
    const done = evaluate(gesture, last)
    if (gesture.kind === "move") {
      const copies = done.copies
      if (gesture.copying !== (copies !== null))
        a.onSelection(copies === null ? gesture.selected : { ids: copies.roots, inside: gesture.selected.inside })
      if (!a.client.push(done.writes).ok && copies !== null) a.onSelection(gesture.selected)
      return
    }
    a.client.push(done.writes)
  }

  return {
    down(event: ReactPointerEvent<HTMLElement>) {
      const a = latest.current
      if (event.button !== 0 && event.button !== 1) return
      const stage = a.stage.current
      if (stage === null) return
      if (inEditor(event.target)) return
      if (a.texting) a.onTextEnd()
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
      if (drawing.includes(a.tool) || a.tool.startsWith("preset:")) {
        stage.setPointerCapture(event.pointerId)
        active.current = { kind: "draw", origin, chain: chainAt(event, a.geometry, a.view), moved: false }
        return
      }
      const grip = gripOf(event.target)
      const [only] = a.selection.ids
      if (grip !== null && isEndGrip(grip) && only !== undefined && a.selection.ids.length === 1) {
        active.current = { kind: "end", grip, origin, line: only, view: a.view, geometry: a.geometry, moved: false }
        return
      }
      if (grip !== null && !isEndGrip(grip)) {
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
      active.current = {
        kind: "move",
        origin,
        ids: next.ids,
        view: a.view,
        geometry: a.geometry,
        alone,
        selected: next,
        copies: null,
        copying: false,
        moved: false,
      }
    },
    double(event: ReactMouseEvent<HTMLElement>) {
      const a = latest.current
      if (inEditor(event.target)) return
      const chain = chainAt(event, a.geometry, a.view)
      if (chain === null) return
      const inside = steppedIn(chain, a.selection)
      if (inside !== null) {
        a.onSelection(inside)
        return
      }
      const leaf = chain[chain.length - 1]!
      if (doom.holdsText(a.view, leaf.id)) {
        a.onSelection({ ids: [leaf.id], inside: a.selection.inside })
        a.onTextEdit(leaf.id, { x: event.clientX, y: event.clientY })
      }
    },
    move(event: ReactPointerEvent<HTMLElement>) {
      const a = latest.current
      if (active.current !== null) {
        schedule(event)
        return
      }
      if (a.panning || a.texting) return
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
    cancelDrag() {
      const had = active.current !== null
      finish(false, null)
      return had
    },
  }
}
