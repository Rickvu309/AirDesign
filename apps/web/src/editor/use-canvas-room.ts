import { useLayoutEffect, useState } from "react"
import { canvasRoom, type SlideSize } from "@/editor/canvas-zoom"

export function useCanvasRoom(): {
  readonly room: SlideSize | null
  readonly onCanvas: (element: HTMLElement | null) => void
} {
  const [canvas, setCanvas] = useState<HTMLElement | null>(null)
  const [room, setRoom] = useState<SlideSize | null>(null)
  useLayoutEffect(() => {
    if (canvas === null) return
    const measure = () => {
      const next = canvasRoom({ width: canvas.clientWidth, height: canvas.clientHeight })
      setRoom((last) => (last?.width === next.width && last.height === next.height ? last : next))
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [canvas])
  return { room, onCanvas: setCanvas }
}
