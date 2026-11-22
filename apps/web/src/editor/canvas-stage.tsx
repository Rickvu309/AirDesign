import { useLayoutEffect, useRef, type PointerEvent, type ReactNode, type RefObject } from "react"

import { canvasInset, slideTop } from "@/editor/canvas-zoom"
import { stagePadding, type WidthLimits } from "@/editor/canvas-viewport"
import { useCanvasGestures, type CanvasView } from "@/editor/use-canvas-gestures"

type Pan = {
  readonly pointer: number
  readonly x: number
  readonly y: number
  readonly left: number
  readonly top: number
}

export function CanvasStage({
  fit = true,
  hand,
  pans = false,
  width,
  height,
  canvasWidth,
  canvasHeight,
  overlay,
  limits,
  onZoom,
  view,
  rulers,
  children,
}: {
  fit?: boolean
  hand: boolean
  pans?: boolean
  width: number
  height: number
  canvasWidth: number
  canvasHeight: number
  overlay: number
  limits?: WidthLimits
  onZoom?: (width: number) => void
  view?: RefObject<CanvasView | null>
  rulers?: ReactNode
  children: ReactNode
}) {
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const pan = useRef<Pan | null>(null)
  const gestures = useCanvasGestures({ root, stage, content, overlay, pans, limits, onZoom, view })
  const padding = stagePadding({ width: canvasWidth, height: canvasHeight - overlay }, fit)
  const top = padding?.block ?? slideTop({ height: canvasHeight, overlay, slide: height })

  useLayoutEffect(() => {
    const element = stage.current
    if (element === null || gestures.placing()) return
    element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2
    element.scrollTop = (element.scrollHeight - element.clientHeight) / 2
  }, [width, fit])

  const laidOut = useRef({ fit, canvasWidth, canvasHeight, overlay, top })
  useLayoutEffect(() => {
    const before = laidOut.current
    laidOut.current = { fit, canvasWidth, canvasHeight, overlay, top }
    const element = stage.current
    if (element === null || fit || before.fit || gestures.placing()) return
    element.scrollLeft += (before.canvasWidth - canvasWidth) / 2
    element.scrollTop += (before.canvasHeight - before.overlay - (canvasHeight - overlay)) / 2 + top - before.top
  }, [canvasWidth, canvasHeight, overlay, top, fit])

  function grab(event: PointerEvent<HTMLDivElement>) {
    const element = stage.current
    if (element === null || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    gestures.setPanning(true)
    pan.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: element.scrollLeft,
      top: element.scrollTop,
    }
  }

  function drag(event: PointerEvent<HTMLDivElement>) {
    const element = stage.current
    const held = pan.current
    if (element === null || held === null || held.pointer !== event.pointerId) return
    element.scrollLeft = held.left - (event.clientX - held.x)
    element.scrollTop = held.top - (event.clientY - held.y)
  }

  function drop(event: PointerEvent<HTMLDivElement>) {
    if (pan.current?.pointer !== event.pointerId) return
    pan.current = null
    gestures.setPanning(false)
  }

  return (
    <div ref={root} className="absolute inset-0">
      <div ref={stage} className="absolute inset-0 overflow-auto" data-canvas-stage data-canvas-fit={fit}>
        <div
          ref={content}
          data-canvas-content
          className="flex w-max min-w-full flex-col items-center"
          style={{
            paddingInline: padding?.inline ?? canvasInset.side,
            paddingTop: top,
            paddingBottom: top + overlay,
          }}
        >
          {children}
        </div>
      </div>
      {rulers}
      {hand || gestures.space || gestures.panning ? (
        <div
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
          data-hand-pan
          onPointerCancel={drop}
          onPointerDown={grab}
          onPointerMove={drag}
          onPointerUp={drop}
          onLostPointerCapture={drop}
        />
      ) : null}
    </div>
  )
}
