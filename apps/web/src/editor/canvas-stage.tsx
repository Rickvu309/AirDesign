import { useLayoutEffect, useRef, type PointerEvent, type ReactNode, type WheelEvent } from "react"

import { canvasInset, slideTop } from "@/editor/canvas-zoom"

type Pan = {
  readonly pointer: number
  readonly x: number
  readonly y: number
  readonly left: number
  readonly top: number
}

export function CanvasStage({
  hand,
  width,
  height,
  canvasHeight,
  overlay,
  children,
}: {
  hand: boolean
  width: number
  height: number
  canvasHeight: number
  overlay: number
  children: ReactNode
}) {
  const stage = useRef<HTMLDivElement>(null)
  const top = slideTop({ height: canvasHeight, overlay, slide: height })
  const pan = useRef<Pan | null>(null)

  useLayoutEffect(() => {
    const element = stage.current
    if (element === null) return
    element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2
    element.scrollTop = (element.scrollHeight - element.clientHeight) / 2
  }, [width, height, canvasHeight, overlay])

  function grab(event: PointerEvent<HTMLDivElement>) {
    const element = stage.current
    if (element === null || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
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
    if (pan.current?.pointer === event.pointerId) pan.current = null
  }

  function wheel(event: WheelEvent<HTMLDivElement>) {
    stage.current?.scrollBy({ left: event.deltaX, top: event.deltaY })
  }

  return (
    <>
      <div ref={stage} className="absolute inset-0 overflow-auto" data-canvas-stage>
        <div
          className="flex w-max min-w-full flex-col items-center"
          style={{ paddingInline: canvasInset.side, paddingTop: top, paddingBottom: top + overlay }}
        >
          {children}
        </div>
      </div>
      {hand ? (
        <div
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
          data-hand-pan
          onPointerCancel={drop}
          onPointerDown={grab}
          onPointerMove={drag}
          onPointerUp={drop}
          onWheel={wheel}
        />
      ) : null}
    </>
  )
}
