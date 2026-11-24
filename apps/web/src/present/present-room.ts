import { useLayoutEffect, useState } from "react"
import type { SlideSize } from "@/editing/canvas-zoom"

export function useRoom(): { readonly room: SlideSize | null; readonly onRoom: (node: HTMLElement | null) => void } {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [room, setRoom] = useState<SlideSize | null>(null)
  useLayoutEffect(() => {
    if (node === null) return
    const measure = () => {
      const width = Math.round(node.clientWidth)
      const height = Math.round(node.clientHeight)
      setRoom((last) => (last?.width === width && last.height === height ? last : { width, height }))
    }
    measure()
    if (typeof ResizeObserver !== "function") {
      window.addEventListener("resize", measure)
      return () => window.removeEventListener("resize", measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return { room, onRoom: setNode }
}
