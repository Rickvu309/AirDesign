import { flushSync } from "react-dom"
import { useLayoutEffect, useState } from "react"
import { canvasRoom, fitWidth, notesWidth as widthOfNotes, slideTop, type SlideSize } from "@/editing/canvas-zoom"

export function useCanvasRoom(): {
  readonly room: SlideSize | null
  readonly width: number
  readonly height: number
  readonly overlay: number
  readonly onOverlay: (element: HTMLElement | null) => void
  readonly onCanvas: (element: HTMLElement | null) => void
} {
  const [canvas, setCanvas] = useState<HTMLElement | null>(null)
  const [overlay, setOverlay] = useState<HTMLElement | null>(null)
  const [canvasWidth, setCanvasWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [overlayHeight, setOverlayHeight] = useState(0)
  const [room, setRoom] = useState<SlideSize | null>(null)
  useLayoutEffect(() => {
    if (canvas === null) return
    const measure = () => {
      const bottom = overlay?.offsetHeight ?? 0
      const wrapper = canvas.querySelector<HTMLElement>("[data-slide-wrapper]")
      const notes = canvas.querySelector<HTMLElement>("[data-notes-bar]")
      const stage = canvas.querySelector<HTMLElement>("[data-canvas-stage]")
      const notesWidth = canvas.querySelector<HTMLElement>("[data-notes-width]")
      const next = canvasRoom({ width: canvas.clientWidth, height: canvas.clientHeight }, bottom)
      if (wrapper && (notes?.dataset.dragging === "true" || notes?.dataset.settling === "true")) {
        const width = wrapper.offsetWidth
        const height = wrapper.offsetHeight
        const fitted = stage?.dataset.canvasFit === "true"
        const scale = fitted ? fitWidth(next, { width, height }) / width : 1
        const top = slideTop({ height: canvas.clientHeight, overlay: bottom, slide: height * scale })
        wrapper.style.transform = `translateY(${top - wrapper.offsetTop - (height * (1 - scale)) / 2}px) scale(${scale})`
        if (notesWidth)
          notesWidth.style.width = `${widthOfNotes(next, { width: width * scale, height: height * scale })}px`
        return
      }
      if (wrapper) wrapper.style.transform = ""
      setCanvasWidth(canvas.clientWidth)
      setHeight(canvas.clientHeight)
      setOverlayHeight(bottom)
      setRoom((last) => (last?.width === next.width && last.height === next.height ? last : next))
    }
    const rest = () => flushSync(measure)
    canvas.addEventListener("notes-rest", rest)
    measure()
    const observer = new ResizeObserver(() => flushSync(measure))
    observer.observe(canvas)
    if (overlay !== null) observer.observe(overlay)
    return () => {
      observer.disconnect()
      canvas.removeEventListener("notes-rest", rest)
    }
  }, [canvas, overlay])
  return { room, width: canvasWidth, height, overlay: overlayHeight, onCanvas: setCanvas, onOverlay: setOverlay }
}
