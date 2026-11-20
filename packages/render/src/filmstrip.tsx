import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { startSettling } from "./settling.js"

function skippedOf(event: Event): boolean {
  return "skipped" in event && event.skipped === true
}

export function Filmstrip(props: {
  readonly width: number
  readonly height: number
  readonly paint: () => ReactNode
  readonly className?: string
}) {
  const cellRef = useRef<HTMLDivElement>(null)
  const paint = useRef(props.paint)
  const [shown, setShown] = useState(false)
  const showing = useRef(false)
  const painting = useRef<(() => void) | null>(null)
  paint.current = props.paint

  useLayoutEffect(() => {
    showing.current = shown
    if (!shown) return
    painting.current?.()
    painting.current = null
  }, [shown])

  useEffect(() => {
    const cell = cellRef.current
    if (cell === null) return
    let pending: number | null = null
    let generation = 0
    const painted = () => {
      painting.current?.()
      painting.current = null
    }
    if (typeof IntersectionObserver === "function") painting.current ??= startSettling()

    const schedule = (near: boolean) => {
      generation += 1
      if (pending !== null) {
        cancelAnimationFrame(pending)
        pending = null
      }
      if (!near) {
        setShown(false)
        painted()
        return
      }
      painting.current ??= startSettling()
      const ticket = generation
      pending = requestAnimationFrame(() => {
        pending = null
        if (ticket !== generation) return
        if (showing.current) painted()
        else setShown(true)
      })
    }

    const onState = (event: Event) => {
      schedule(!skippedOf(event))
    }

    let observer: IntersectionObserver | undefined
    if (typeof IntersectionObserver === "function") {
      const root = cell.closest("[data-slide-list]")
      observer = new IntersectionObserver(
        (entries) => {
          schedule(entries.some((entry) => entry.isIntersecting))
        },
        { root: root instanceof Element ? root : null, rootMargin: "200px 0px" },
      )
      observer.observe(cell)
    } else {
      cell.addEventListener("contentvisibilityautostatechange", onState)
    }

    return () => {
      generation += 1
      if (pending !== null) cancelAnimationFrame(pending)
      observer?.disconnect()
      cell.removeEventListener("contentvisibilityautostatechange", onState)
      painted()
    }
  }, [])

  return (
    <div
      ref={cellRef}
      aria-hidden="true"
      className={props.className}
      data-slide-card
      data-slide-thumb
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: `auto ${props.width}px auto ${props.height}px`,
        width: props.width,
        height: props.height,
        pointerEvents: "none",
      }}
    >
      {shown ? paint.current() : null}
    </div>
  )
}
