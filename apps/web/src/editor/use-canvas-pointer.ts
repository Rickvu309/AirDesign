import * as doom from "@airdesign/doom"
import type { TransformGrip } from "./transform-math"
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react"
import type { Preview } from "./canvas-overlay"
import { hitChain } from "./hit-test"
import { cropDrag, isCropGrip, type CropGrip } from "./crop-drag"
import type { CropTarget } from "./crop-handles"
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
import type { CanvasGesture } from "./canvas-gesture"
import { transformedBy } from "./transform-drag"
import { commitDesignEdit } from "./component-edits"
import type { EditorClient } from "./use-deck"

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
  readonly crop: CropTarget | null
  readonly onCrop: (id: doom.NodeId) => void
  readonly onCropEnd: () => void
  readonly onBlank?: () => void
  readonly pointAt?: (client: Point) => Point
}

const threshold = 3

export function dragButton(event: { readonly button: number; readonly ctrlKey: boolean }): boolean {
  return event.button === 0 || event.button === 1 || (event.button === 2 && event.ctrlKey)
}

export function freesAspect(
  event: { readonly ctrlKey: boolean; getModifierState(name: string): boolean },
  fnHeld: boolean,
): boolean {
  return event.ctrlKey || fnHeld || event.getModifierState("Fn")
}

function inEditor(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-text-editor]") !== null
}

function holdsPicture(view: doom.Doom, id: doom.NodeId): boolean {
  const node = view.nodes.get(id)
  return (
    doom.propOf(node, "geometry")?.kind !== "icon" &&
    (doom.propOf(node, "fills") ?? []).some((paint) => paint.kind === "image" && paint.visible !== false)
  )
}

function gripOf(target: EventTarget | null): TransformGrip | EndGrip | CropGrip | null {
  const found = target instanceof Element ? target.closest("[data-grip]")?.getAttribute("data-grip") : null
  return found === null || found === undefined ? null : (found as TransformGrip | EndGrip | CropGrip)
}

export function useCanvasPointer(args: PointerArgs) {
  const latest = useRef(args)
  useLayoutEffect(() => {
    latest.current = args
  })
  const active = useRef<CanvasGesture | null>(null)
  const fnDown = useRef(false)
  useEffect(() => {
    const fnKey = (event: KeyboardEvent) => {
      if (event.type === "keyup" && (event.key === "Fn" || event.code === "Fn")) fnDown.current = false
      else fnDown.current = event.key === "Fn" || event.code === "Fn" || event.getModifierState("Fn")
    }
    window.addEventListener("keydown", fnKey)
    window.addEventListener("keyup", fnKey)
    const stage = latest.current.stage.current
    if (stage === null)
      return () => {
        window.removeEventListener("keydown", fnKey)
        window.removeEventListener("keyup", fnKey)
      }
    const leave = () => latest.current.setHover(null)
    const menu = (event: Event) => {
      if (event instanceof MouseEvent && event.ctrlKey) event.preventDefault()
    }
    stage.addEventListener("pointerleave", leave)
    stage.addEventListener("contextmenu", menu)
    return () => {
      stage.removeEventListener("pointerleave", leave)
      stage.removeEventListener("contextmenu", menu)
      window.removeEventListener("keydown", fnKey)
      window.removeEventListener("keyup", fnKey)
    }
  }, [])
  const pending = useRef<PointerEvent | ReactPointerEvent | null>(null)
  const frame = useRef(0)
  const pressedAt = useRef<Point>({ x: 0, y: 0 })

  function screenScale(): number {
    const current = latest.current
    if (current.pointAt === undefined) return current.scale
    const box = current.slideBox.current?.getBoundingClientRect()
    if (box === undefined || current.size.w <= 0 || box.width <= 0) return current.scale
    return box.width / current.size.w
  }

  const toSlide = (event: { readonly clientX: number; readonly clientY: number }): Point => {
    const pointAt = latest.current.pointAt
    if (pointAt !== undefined) return pointAt({ x: event.clientX, y: event.clientY })
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
  ) => hitChain(geometry.roots, toSlide(event), 4.5 / screenScale(), (id) => doom.lockedIn(view, id))

  type Evaluated = Pick<Preview, "writes" | "guides" | "label"> & { readonly copies: doom.Copies | null }

  function evaluate(
    gesture: Extract<CanvasGesture, { kind: "move" | "transform" }>,
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
        scale: screenScale(),
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
      breakAspect: freesAspect(event, fnDown.current),
      fromCenter: event.altKey,
      snapAngle: event.shiftKey,
      snap: !event.ctrlKey,
      scale: screenScale(),
      size: a.size,
    })
    return { ...transformed, copies: null }
  }

  function farFromPress(event: PointerEvent | ReactPointerEvent): boolean {
    return Math.hypot(event.clientX - pressedAt.current.x, event.clientY - pressedAt.current.y) >= threshold
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
    if (!gesture.moved && !farFromPress(event)) return
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
        scale: screenScale(),
      })
      a.setPreview({ kind: "end", writes: done.writes, guides: [], label: null, aim: done.aim })
      return
    }
    if (gesture.kind === "crop") {
      const writes = cropDrag({
        view: gesture.view,
        geometry: gesture.geometry,
        node: gesture.target.node,
        grip: gesture.grip,
        origin: gesture.origin,
        at,
        natural: gesture.target.natural,
      })
      a.setPreview(writes.length === 0 ? null : { kind: "crop", writes, guides: [], label: null })
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
    boxed(gesture, rect, event)
  }

  function boxed(
    gesture: Extract<CanvasGesture, { kind: "marquee" }>,
    rect: Rect,
    event: PointerEvent | ReactPointerEvent,
  ) {
    const a = latest.current
    const hits = marqueeSelection(gesture.geometry, rect, {
      deep: event.metaKey || event.ctrlKey,
      locked: (id) => doom.lockedIn(gesture.view, id),
    })
    const ids = [...new Set([...gesture.base, ...hits])]
    const shown = ids.join(" ")
    if (shown === gesture.shown) return
    gesture.shown = shown
    a.onSelection({ ids, inside: null })
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
    if (gesture?.kind === "marquee") {
      if (!commit || last === null) a.onSelection(gesture.before)
      else if (gesture.moved || farFromPress(last)) boxed(gesture, rectBetween(gesture.origin, toSlide(last)), last)
      else if (gesture.blank) a.onBlank?.()
      return
    }
    if (gesture?.kind === "draw" && commit && last !== null) {
      const at = toSlide(last)
      const far = gesture.moved || farFromPress(last)
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
    if (gesture?.kind === "crop") {
      if (!commit || last === null || !gesture.moved) return
      a.client.push(
        cropDrag({
          view: gesture.view,
          geometry: gesture.geometry,
          node: gesture.target.node,
          grip: gesture.grip,
          origin: gesture.origin,
          at: toSlide(last),
          natural: gesture.target.natural,
        }),
      )
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
        scale: screenScale(),
      })
      a.client.push(done.writes)
      return
    }
    if (gesture?.kind === "move" && gesture.copying && !commit) a.onSelection(gesture.selected)
    if (gesture === null || (gesture.kind !== "move" && gesture.kind !== "transform") || !commit || last === null)
      return
    if (!gesture.moved && !farFromPress(last)) {
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
    commitDesignEdit(a.client, done.writes, gesture.view)
  }

  return {
    down(event: ReactPointerEvent<HTMLElement>) {
      const a = latest.current
      if (!dragButton(event)) return
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
      pressedAt.current = { x: event.clientX, y: event.clientY }
      const origin = toSlide(event)
      const grip = gripOf(event.target)
      if (a.crop !== null && grip !== null && isCropGrip(grip)) {
        active.current = {
          kind: "crop",
          grip,
          origin,
          target: a.crop,
          view: a.view,
          geometry: a.geometry,
          moved: false,
        }
        return
      }
      if (a.crop !== null) a.onCropEnd()
      if (drawing.includes(a.tool) || a.tool.startsWith("preset:")) {
        stage.setPointerCapture(event.pointerId)
        active.current = { kind: "draw", origin, chain: chainAt(event, a.geometry, a.view), moved: false }
        return
      }
      const [only] = a.selection.ids
      if (grip !== null && isEndGrip(grip) && only !== undefined && a.selection.ids.length === 1) {
        active.current = { kind: "end", grip, origin, line: only, view: a.view, geometry: a.geometry, moved: false }
        return
      }
      if (grip !== null && !isEndGrip(grip) && !isCropGrip(grip)) {
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
        const blank = a.onBlank !== undefined && a.tool === "move"
        if (blank && a.geometry.roots.length === 0) return
        if (blank) event.preventDefault()
        else if (!event.shiftKey) a.onSelection(noSelection)
        active.current = {
          kind: "marquee",
          origin,
          base: event.shiftKey ? a.selection.ids : [],
          before: a.selection,
          blank,
          geometry: a.geometry,
          view: a.view,
          shown: null,
          moved: false,
        }
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
      if (holdsPicture(a.view, leaf.id)) {
        a.onSelection({ ids: [leaf.id], inside: a.selection.inside })
        a.onCrop(leaf.id)
        return
      }
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
    dragging() {
      return active.current !== null
    },
    cancelDrag() {
      const had = active.current !== null
      finish(false, null)
      return had
    },
  }
}
