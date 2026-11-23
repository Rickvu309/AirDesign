import { useLayoutEffect, useRef, useState } from "react"

export type Size = { readonly width: number; readonly height: number }

const inset = 16

export function fittedWidth(box: Size, slide: Size): number {
  if (slide.width <= 0 || slide.height <= 0) return 0
  const room = { width: box.width - inset * 2, height: box.height - inset * 2 }
  return Math.max(0, Math.floor(Math.min(room.width, (room.height * slide.width) / slide.height)))
}

export function usePreviewBox() {
  const frame = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<Size | null>(null)
  useLayoutEffect(() => {
    const node = frame.current
    if (node === null) return
    const measure = () => {
      const width = Math.round(node.clientWidth)
      const height = Math.round(node.clientHeight)
      setBox((shown) => (shown?.width === width && shown.height === height ? shown : { width, height }))
    }
    measure()
    if (typeof ResizeObserver !== "function") return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return { frame, box }
}
