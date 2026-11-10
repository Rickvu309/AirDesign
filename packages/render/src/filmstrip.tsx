import { useEffect, useRef } from "react"
import type { Thumb } from "./record.js"

type DeepThumbRecord = Extract<Thumb, { readonly kind: "deep" }>

function drawThumb(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("2d")
  if (context === null) return
  context.fillRect(0, 0, canvas.width, canvas.height)
}

function skippedOf(event: Event): boolean {
  return "skipped" in event && event.skipped === true
}

function DeepThumb(props: { readonly thumb: DeepThumbRecord }) {
  const cellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cell = cellRef.current
    if (cell === null) return
    const canvas = cell.querySelector("canvas")
    if (!(canvas instanceof HTMLCanvasElement)) return
    let pending: number | null = null
    let generation = 0

    const onState = (event: Event) => {
      if (skippedOf(event)) {
        generation += 1
        if (pending !== null) {
          cancelAnimationFrame(pending)
          pending = null
        }
        return
      }
      if (pending !== null) cancelAnimationFrame(pending)
      generation += 1
      const ticket = generation
      pending = requestAnimationFrame(() => {
        pending = null
        if (ticket !== generation) return
        drawThumb(canvas)
      })
    }

    cell.addEventListener("contentvisibilityautostatechange", onState)
    return () => {
      generation += 1
      if (pending !== null) cancelAnimationFrame(pending)
      cell.removeEventListener("contentvisibilityautostatechange", onState)
    }
  }, [])

  return (
    <div
      ref={cellRef}
      data-thumb={props.thumb.id}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: `auto ${props.thumb.width}px auto ${props.thumb.height}px`,
      }}
    >
      <canvas width={props.thumb.width} height={props.thumb.height} />
    </div>
  )
}

export function Filmstrip(props: { readonly thumbs: readonly Thumb[] }) {
  return (
    <div>
      {props.thumbs.map((thumb) =>
        thumb.kind === "image" ? (
          <img key={thumb.id} data-thumb={thumb.id} src={thumb.src} alt="" />
        ) : (
          <DeepThumb key={thumb.id} thumb={thumb} />
        ),
      )}
    </div>
  )
}
