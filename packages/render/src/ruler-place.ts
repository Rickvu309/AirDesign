import type { ElementId } from "@airdesign/document"
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react"
import { paintedBounds } from "./drag-snap.js"
import type { CanvasSlide } from "./record.js"
import { around, type Bounds } from "./snapping.js"
import type { PaintStore } from "./store.js"

export type Place = {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
  readonly pixelsPerEmu: number
}

function samePlace(one: Place | null, two: Place | null): boolean {
  if (one === null || two === null) return one === two
  return (
    Math.abs(one.left - two.left) < 0.25 &&
    Math.abs(one.top - two.top) < 0.25 &&
    Math.abs(one.width - two.width) < 0.25 &&
    Math.abs(one.height - two.height) < 0.25 &&
    Math.abs(one.pixelsPerEmu - two.pixelsPerEmu) < 1e-12
  )
}

function measuredPlace(host: HTMLElement, slideWidth: number): Place | null {
  const stage = host.parentElement
  const paint = stage?.querySelector<HTMLElement>("[data-slide-paint]")
  if (paint === null || paint === undefined) return null
  const frame = host.getBoundingClientRect()
  const slide = paint.getBoundingClientRect()
  if (slide.width <= 0 || slideWidth <= 0) return null
  return {
    left: slide.left - frame.left,
    top: slide.top - frame.top,
    width: frame.width,
    height: frame.height,
    pixelsPerEmu: slide.width / slideWidth,
  }
}

export function useSlidePlace(host: RefObject<HTMLDivElement | null>, slide: CanvasSlide): Place | null {
  const [place, setPlace] = useState<Place | null>(null)
  const latest = useRef<Place | null>(null)
  useLayoutEffect(() => {
    const element = host.current
    const stage = element?.parentElement
    if (element === null || element === undefined || stage === null || stage === undefined) return
    let frame = 0
    const measure = () => {
      frame = 0
      const next = measuredPlace(element, slide.width)
      if (samePlace(next, latest.current)) return
      latest.current = next
      setPlace(next)
    }
    const soon = () => {
      if (frame === 0) frame = requestAnimationFrame(measure)
    }
    measure()
    const sizes = new ResizeObserver(soon)
    sizes.observe(element)
    const wrapper = stage.querySelector("[data-slide-wrapper]")
    if (wrapper !== null) sizes.observe(wrapper)
    const content = stage.querySelector("[data-canvas-content]")
    const styles = new MutationObserver(soon)
    if (content !== null) styles.observe(content, { attributes: true, attributeFilter: ["style"] })
    stage.addEventListener("scroll", soon, { capture: true, passive: true })
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      sizes.disconnect()
      styles.disconnect()
      stage.removeEventListener("scroll", soon, { capture: true })
    }
  }, [host, slide])
  return place
}

export function useSelectionBounds(
  slide: CanvasSlide,
  store: PaintStore,
  selected: readonly ElementId[],
): Bounds | null {
  const said = useRef<{ key: string; bounds: Bounds | null }>({ key: "", bounds: null })
  const read = () => {
    const bounds = around(
      slide.elements.flatMap((element) => {
        if (element.id === null || !selected.includes(element.id)) return []
        const found = paintedBounds(element, store)
        return found === null ? [] : [found]
      }),
    )
    const key = JSON.stringify(bounds)
    if (key !== said.current.key) said.current = { key, bounds }
    return said.current.bounds
  }
  const subscribe = (listener: () => void) => {
    const leaves = selected.map((id) => store.boxSubscribe(id)(listener))
    return () => {
      for (const leave of leaves) leave()
    }
  }
  return useSyncExternalStore(subscribe, read, read)
}
