import type { Box, ElementId } from "@airdesign/document"
import { boxOf, emuOf, movedBoxes, ownBox, sameBox, travelled, type Point, type SlideSize } from "./box-gesture.js"
import { snappedTransform, type DragSnap } from "./drag-snap.js"
import { oncePerFrame } from "./once-per-frame.js"
import type { CanvasElement, CanvasSlide } from "./record.js"
import type { Guide } from "./snapping.js"
import type { PaintStore } from "./store.js"
import type { TransformHudState } from "./transform-hud.js"
import {
  constrainMove,
  flipSelection,
  isResizeGrip,
  isRotateGrip,
  normalizeDegrees,
  resizeBox,
  resizeSelection,
  rotateSelection,
  selectionFrame,
  type FlippableLayer,
  type FlippedLayer,
  type RotatedLayer,
  type TransformGrip,
} from "./transform-math.js"

export type TransformActions = {
  readonly onRotate?: (turned: readonly Turned[]) => void
  readonly onFlip?: (flipped: readonly FlippedLayer[]) => void
  readonly relayout?: (boxes: ReadonlyMap<ElementId, Box>) => ReadonlyMap<ElementId, Box> | null
}

export type TransformModifiers = {
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly ctrlKey: boolean
}

export type Turned = {
  readonly id: ElementId
  readonly rotation: number
  readonly box?: Box
}

export type TransformResult = {
  readonly boxes: ReadonlyMap<ElementId, Box>
  readonly rotations: ReadonlyMap<ElementId, number>
  readonly hud: TransformHudState | null
}

export type SnappedResult = TransformResult & { readonly guides: readonly Guide[] }

export type TransformDragInput = {
  readonly grip: TransformGrip
  readonly ids: readonly ElementId[]
  readonly starts: ReadonlyMap<ElementId, RotatedLayer>
  readonly from: Point
  readonly at: Point
  readonly width: number
  readonly slide: SlideSize
  readonly modifiers: TransformModifiers
  readonly centerScreen: Point
}

export function canResizeElement(element: CanvasElement): boolean {
  return element.id !== null && element.movable === true && element.box !== null && element.connection === undefined
}

export function canRotateElement(element: CanvasElement): boolean {
  return (
    canResizeElement(element) &&
    element.frame !== "auto" &&
    element.kind !== "table" &&
    element.kind !== "chart" &&
    element.group?.frame === undefined &&
    element.inFrame === undefined
  )
}

export function canFlipElement(element: CanvasElement): boolean {
  return canRotateElement(element)
}

export function dragLayersOf(
  slide: CanvasSlide,
  store: PaintStore,
  ids: readonly ElementId[],
): ReadonlyMap<ElementId, RotatedLayer> {
  const layers = new Map<ElementId, RotatedLayer>()
  for (const id of ids) {
    const element = slide.elements.find((each) => each.id === id)
    if (element === undefined) continue
    const shown = ownBox(element, store.getBox(id), store.getRotation(id))
    if (shown === null) continue
    layers.set(id, { box: boxOf(shown), rotation: normalizeDegrees(shown.rotation) })
  }
  return layers
}

export function flippableOf(
  slide: CanvasSlide,
  store: PaintStore,
  ids: readonly ElementId[],
): ReadonlyMap<ElementId, FlippableLayer> {
  const layers = new Map<ElementId, FlippableLayer>()
  for (const id of ids) {
    const element = slide.elements.find((each) => each.id === id)
    if (element === undefined || !canFlipElement(element)) continue
    const shown = ownBox(element, store.getBox(id), store.getRotation(id))
    if (shown === null) continue
    layers.set(id, {
      box: boxOf(shown),
      rotation: normalizeDegrees(shown.rotation),
      flipH: shown.flipH,
      flipV: shown.flipV,
    })
  }
  return layers
}

export function flipsBy(
  slide: CanvasSlide,
  store: PaintStore,
  ids: readonly ElementId[],
  gesture: "flip-horizontal" | "flip-vertical",
): readonly FlippedLayer[] {
  return flipSelection(flippableOf(slide, store, ids), gesture === "flip-horizontal" ? "horizontal" : "vertical")
}

export function centerOnScreen(
  surface: HTMLElement | null,
  width: number,
  slide: SlideSize,
  starts: ReadonlyMap<ElementId, RotatedLayer>,
): Point {
  const frame = selectionFrame(starts)
  if (frame === null) return { x: 0, y: 0 }
  const rect = surface?.getBoundingClientRect()
  const shownWidth = rect !== undefined && rect.width > 0 ? rect.width : width
  const left = rect !== undefined && rect.width > 0 ? rect.left : 0
  const top = rect !== undefined && rect.width > 0 ? rect.top : 0
  const scale = shownWidth / slide.width
  return {
    x: left + (frame.x + frame.cx / 2) * scale,
    y: top + (frame.y + frame.cy / 2) * scale,
  }
}

export function evaluateTransform(input: TransformDragInput): TransformResult {
  const { at, centerScreen, from, grip, ids, modifiers, slide, starts, width } = input
  if (grip === "move") {
    const rawDx = emuOf(at.x - from.x, width, slide)
    const rawDy = emuOf(at.y - from.y, width, slide)
    const { dx, dy } = constrainMove(rawDx, rawDy, modifiers.shiftKey)
    const boxStarts = new Map([...starts].map(([id, layer]) => [id, layer.box]))
    return { boxes: movedBoxes(boxStarts, dx, dy, slide), rotations: new Map(), hud: null }
  }
  if (isRotateGrip(grip)) {
    const rotated = rotateSelection(starts, centerScreen, from, at, modifiers.shiftKey)
    const boxes = new Map<ElementId, Box>()
    const rotations = new Map<ElementId, number>()
    for (const [id, layer] of rotated.layers) {
      if (ids.length > 1) boxes.set(id, layer.box)
      rotations.set(id, layer.rotation)
    }
    const single = ids.length === 1 ? rotated.layers.get(ids[0]!) : undefined
    const frame = single !== undefined ? single.box : selectionFrame(rotated.layers)
    const hud: TransformHudState | null =
      frame === null
        ? null
        : {
            kind: "rotate",
            frame,
            rotation: single?.rotation ?? 0,
            displayAngle: rotated.displayAngle,
          }
    return { boxes, rotations, hud }
  }
  if (isResizeGrip(grip)) {
    const dx = emuOf(at.x - from.x, width, slide)
    const dy = emuOf(at.y - from.y, width, slide)
    const resizeModifiers = { keepRatio: modifiers.shiftKey, fromCenter: modifiers.altKey }
    if (ids.length === 1) {
      const id = ids[0]
      const start = id === undefined ? undefined : starts.get(id)
      if (id === undefined || start === undefined) return { boxes: new Map(), rotations: new Map(), hud: null }
      const next = resizeBox(start.box, grip, dx, dy, resizeModifiers, start.rotation)
      return {
        boxes: new Map([[id, next]]),
        rotations: new Map(),
        hud: { kind: "resize", frame: next, rotation: start.rotation },
      }
    }
    const resized = resizeSelection(starts, grip, dx, dy, resizeModifiers)
    return {
      boxes: resized.boxes,
      rotations: new Map(),
      hud: { kind: "resize", frame: resized.frame, rotation: 0 },
    }
  }
  return { boxes: new Map(), rotations: new Map(), hud: null }
}

export function finishedTurns(starts: ReadonlyMap<ElementId, RotatedLayer>, store: PaintStore): readonly Turned[] {
  const turned: Turned[] = []
  for (const [id, start] of starts) {
    const nextRot = store.getRotation(id)
    const nextBox = store.getBox(id)
    const rotChanged = nextRot !== null && nextRot !== start.rotation
    const boxChanged = nextBox !== null && !sameBox(nextBox, start.box)
    if (!rotChanged && !boxChanged) continue
    turned.push({
      id,
      rotation: nextRot ?? start.rotation,
      ...(boxChanged ? { box: nextBox } : {}),
    })
  }
  return turned
}

export type PointerDrag = {
  readonly by: "pointer"
  readonly ids: readonly ElementId[]
  readonly grip: TransformGrip
  readonly pointer: number
  readonly from: Point
  readonly starts: ReadonlyMap<ElementId, Box>
  readonly layers: ReadonlyMap<ElementId, RotatedLayer>
  readonly centerScreen: Point
  readonly moved: boolean
  readonly enter?: ElementId
  readonly toggleOnClick?: ElementId
}

export type DragAfter = { readonly enter?: ElementId; readonly toggleOnClick?: ElementId }

type Pressed = { readonly pointerId: number; readonly clientX: number; readonly clientY: number }

type Canvas = {
  readonly surface: HTMLElement | null
  readonly slide: CanvasSlide
  readonly store: PaintStore
  readonly width: number
}

export function modifiersOf(event: {
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly ctrlKey: boolean
}) {
  return { shiftKey: event.shiftKey, altKey: event.altKey, ctrlKey: event.ctrlKey }
}

export function pointerDragOf(
  event: Pressed,
  canvas: Canvas,
  starts: ReadonlyMap<ElementId, Box>,
  ids: readonly ElementId[],
  grip: TransformGrip,
  after: DragAfter,
): PointerDrag | null {
  if (ids[0] === undefined || !starts.has(ids[0])) return null
  const held = ids.filter((each) => starts.has(each))
  const layers = dragLayersOf(canvas.slide, canvas.store, held)
  return {
    by: "pointer",
    ids: held,
    grip,
    pointer: event.pointerId,
    from: { x: event.clientX, y: event.clientY },
    starts,
    layers,
    centerScreen: centerOnScreen(canvas.surface, canvas.width, canvas.slide, layers),
    moved: false,
    ...after,
  }
}

const modifierKeys = new Set(["Shift", "Alt", "Control"])

export function watchPointerDrag(options: {
  readonly document: Document
  readonly pointer: number
  readonly from: Point
  readonly initialModifiers: TransformModifiers
  readonly width: number
  readonly slide: SlideSize
  readonly snap: DragSnap
  readonly copySnap?: DragSnap
  readonly onCopying?: (copying: boolean) => void
  readonly current: () => PointerDrag | null
  readonly markMoved: (now: PointerDrag) => PointerDrag
  readonly applyResult: (result: SnappedResult) => void
  readonly onFinish: (now: PointerDrag) => void
  readonly onCancel: () => void
  readonly onStop: () => void
}): () => void {
  const { applyResult, current, document, from, markMoved, onCancel, onFinish, onStop, pointer, slide, width } = options
  let lastPoint = from
  let lastModifiers = options.initialModifiers

  function apply(now: PointerDrag, at: Point, modifiers: TransformModifiers) {
    const input = {
      grip: now.grip,
      ids: now.ids,
      starts: now.layers,
      from: now.from,
      at,
      width,
      slide,
      modifiers,
      centerScreen: now.centerScreen,
    }
    const copying = now.grip === "move" && modifiers.altKey && options.copySnap !== undefined
    options.onCopying?.(copying)
    const snap = copying ? (options.copySnap ?? options.snap) : options.snap
    applyResult(snappedTransform(input, evaluateTransform, modifiers.ctrlKey ? null : snap))
  }

  const painting = oncePerFrame(({ at, modifiers }: { readonly at: Point; readonly modifiers: TransformModifiers }) => {
    const now = current()
    if (now !== null) apply(now, at, modifiers)
  })

  function move(event: globalThis.PointerEvent) {
    const now = current()
    if (now === null || event.pointerId !== now.pointer) return
    lastPoint = { x: event.clientX, y: event.clientY }
    lastModifiers = { shiftKey: event.shiftKey, altKey: event.altKey, ctrlKey: event.ctrlKey }
    if (!now.moved && !travelled(now.from, lastPoint)) return
    if (!now.moved) markMoved(now)
    painting.push({ at: lastPoint, modifiers: lastModifiers })
  }

  function modifierChanged(event: globalThis.KeyboardEvent) {
    if (!modifierKeys.has(event.key)) return
    const now = current()
    if (now === null) return
    lastModifiers = { shiftKey: event.shiftKey, altKey: event.altKey, ctrlKey: event.ctrlKey }
    if (now.moved) painting.push({ at: lastPoint, modifiers: lastModifiers })
  }

  function stop() {
    document.removeEventListener("pointermove", move)
    document.removeEventListener("pointerup", end)
    document.removeEventListener("pointercancel", lost)
    document.removeEventListener("keydown", modifierChanged)
    document.removeEventListener("keyup", modifierChanged)
    onStop()
  }

  function cancel() {
    painting.drop()
    stop()
    onCancel()
  }

  function end(event: globalThis.PointerEvent) {
    if (event.pointerId !== pointer) return
    painting.flush()
    stop()
    const now = current()
    if (now !== null) onFinish(now)
  }

  function lost(event: globalThis.PointerEvent) {
    if (event.pointerId === pointer) cancel()
  }

  document.addEventListener("pointermove", move)
  document.addEventListener("pointerup", end)
  document.addEventListener("pointercancel", lost)
  document.addEventListener("keydown", modifierChanged)
  document.addEventListener("keyup", modifierChanged)
  return cancel
}
