import { useLayoutEffect, useRef, useState, type RefObject } from "react"
import type { Size } from "./canvas-view"

export function useCanvasPan(stage: RefObject<HTMLDivElement | null>, placed: boolean) {
  const [box, setBox] = useState<Size>({ w: 0, h: 0 })
  const left = Math.floor(box.w / 2)
  const top = Math.floor(box.h / 2)
  const previous = useRef({ left: 0, top: 0 })

  useLayoutEffect(() => {
    const element = stage.current
    if (placed || element === null) return
    const measure = () => setBox({ w: element.clientWidth, h: element.clientHeight })
    measure()
    const watcher = new ResizeObserver(measure)
    watcher.observe(element, { box: "border-box" })
    return () => watcher.disconnect()
  }, [stage, placed])

  useLayoutEffect(() => {
    const element = stage.current
    if (placed || element === null) return
    element.scrollLeft += left - previous.current.left
    element.scrollTop += top - previous.current.top
    previous.current = { left, top }
  }, [stage, placed, left, top])

  return { box, left, top }
}
