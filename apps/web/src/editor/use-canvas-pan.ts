import { useCallback, useLayoutEffect, useRef, type RefObject } from "react"
import type { Size } from "./canvas-view"
import type { Point } from "./slide-geometry"

export const unpanned: Point = { x: 0, y: 0 }

export type CanvasPan = {
  readonly position: () => Point
  readonly moveTo: (point: Point) => void
}

function panAxis(value: number, viewport: number, content: number) {
  const margin = Math.floor(viewport / 2)
  const range = Math.max(0, Math.round(content - viewport))
  const offset = Math.max(-range - margin, Math.min(margin, value))
  const position = Math.round(offset)
  const scroll = Math.max(0, Math.min(range, -position))
  return { offset, scroll, shift: position + scroll }
}

export function useCanvasPan(stage: RefObject<HTMLDivElement | null>, viewport: Size | null, content: Size) {
  const layer = useRef<HTMLDivElement>(null)
  const offset = useRef(unpanned)
  const programmed = useRef(unpanned)
  const width = viewport?.w
  const height = viewport?.h
  const { w, h } = content
  const moveTo = useCallback(
    (point: Point) => {
      const element = stage.current
      if (element === null || layer.current === null || width === undefined || height === undefined) return
      const x = panAxis(point.x, width, w)
      const y = panAxis(point.y, height, h)
      element.scrollTo(x.scroll, y.scroll)
      programmed.current = { x: element.scrollLeft, y: element.scrollTop }
      offset.current = { x: x.offset, y: y.offset }
      layer.current.style.translate = x.shift === 0 && y.shift === 0 ? "" : `${x.shift}px ${y.shift}px`
    },
    [stage, width, height, w, h],
  )

  useLayoutEffect(() => {
    const element = stage.current
    if (element === null || width === undefined || height === undefined) return
    const remember = () => {
      if (element.clientWidth !== width || element.clientHeight !== height) return
      const x = element.scrollLeft
      const y = element.scrollTop
      offset.current = {
        x: offset.current.x + programmed.current.x - x,
        y: offset.current.y + programmed.current.y - y,
      }
      programmed.current = { x, y }
    }
    moveTo(offset.current)
    element.addEventListener("scroll", remember)
    return () => element.removeEventListener("scroll", remember)
  }, [stage, moveTo, width, height])

  return { layer, position: () => offset.current, moveTo }
}
