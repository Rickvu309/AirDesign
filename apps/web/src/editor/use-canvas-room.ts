import { useLayoutEffect, useState } from "react"
import { canvasRoom, type SlideSize } from "@/editor/canvas-zoom"

export function useCanvasRoom(): {
  readonly room: SlideSize | null
  readonly height: number
  readonly overlay: number
  readonly onOverlay: (element: HTMLElement | null) => void
  readonly onCanvas: (element: HTMLElement | null) => void
} {
  const [canvas, setCanvas] = useState<HTMLElement | null>(null)
  const [overlay, setOverlay] = useState<HTMLElement | null>(null)
  const [height, setHeight] = useState(0)
  const [overlayHeight, setOverlayHeight] = useState(0)
  const [room, setRoom] = useState<SlideSize | null>(null)
  useLayoutEffect(() => {
    if (canvas === null) return
    const measure = () => {
      const bottom = overlay?.offsetHeight ?? 0
      setHeight(canvas.clientHeight)
      setOverlayHeight(bottom)
      const next = canvasRoom({ width: canvas.clientWidth, height: canvas.clientHeight }, bottom)
      setRoom((last) => (last?.width === next.width && last.height === next.height ? last : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    if (overlay !== null) observer.observe(overlay)
    return () => observer.disconnect()
  }, [canvas, overlay])
  return { room, height, overlay: overlayHeight, onCanvas: setCanvas, onOverlay: setOverlay }
}
