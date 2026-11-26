import { useLayoutEffect, useRef, type RefObject } from "react"
import type { Size } from "./canvas-view"

const empty: Size = { w: 0, h: 0 }

export function useCanvasPan(stage: RefObject<HTMLDivElement | null>, viewport: Size | null) {
  const box = viewport ?? empty
  const { w, h } = box
  const left = Math.floor(w / 2)
  const top = Math.floor(h / 2)
  const offset = useRef({ left: 0, top: 0 })
  const scrollable = viewport !== null

  useLayoutEffect(() => {
    const element = stage.current
    if (!scrollable || element === null) return
    const remember = () => {
      if (element.clientWidth !== w || element.clientHeight !== h) return
      offset.current = { left: element.scrollLeft - left, top: element.scrollTop - top }
    }
    element.scrollTo({ left: left + offset.current.left, top: top + offset.current.top })
    remember()
    element.addEventListener("scroll", remember)
    return () => element.removeEventListener("scroll", remember)
  }, [stage, scrollable, w, h, left, top])

  return { box, left, top }
}
