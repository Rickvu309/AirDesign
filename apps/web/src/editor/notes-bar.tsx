import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"

import {
  clampNotesHeight,
  maxNotesHeight,
  notesClosed,
  notesMinimum,
  notesOpacity,
  notesVelocity,
  rawNotesHeight,
  releaseNotesHeight,
  trackNotesHeight,
  type NotesSample,
} from "./notes-height"

export function NotesBar({ text, onEdit }: { readonly text: string; readonly onEdit?: (text: string) => void }) {
  const [open, setOpen] = useState(true)
  const [height, setHeight] = useState(notesMinimum)
  const [maximum, setMaximum] = useState(Number.MAX_SAFE_INTEGER)
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frame = useRef<number | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const description = useId()
  const drag = useRef<{
    id: number
    y: number
    height: number
    open: boolean
    moved: boolean
    raw: number
    samples: NotesSample[]
  } | null>(null)
  const suppressClick = useRef(false)
  useLayoutEffect(() => {
    const element = bar.current
    const canvas = element?.closest("[data-editor-canvas]")
    const overlay = element?.closest("[data-canvas-overlay]")
    if (!element || !(canvas instanceof HTMLElement) || !(overlay instanceof HTMLElement)) return
    const measure = () => {
      const limit = maxNotesHeight(canvas.clientHeight, overlay.offsetHeight - element.offsetHeight)
      setMaximum(limit)
      setHeight((last) => clampNotesHeight(last, limit))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])
  const field = useRef<HTMLTextAreaElement>(null)
  const expand = useRef<HTMLButtonElement>(null)
  const toggled = useRef(false)
  useEffect(() => {
    const box = field.current
    if (!open || box === null) {
      if (toggled.current) expand.current?.focus()
      return
    }
    if (toggled.current) {
      box.focus()
      box.setSelectionRange(box.value.length, box.value.length)
    }
    const refuse = (event: InputEvent) => {
      if (event.inputType.startsWith("history")) event.preventDefault()
    }
    box.addEventListener("beforeinput", refuse)
    return () => box.removeEventListener("beforeinput", refuse)
  }, [open])
  function toggle(next: boolean) {
    toggled.current = true
    setOpen(next)
  }
  function paint(next: number) {
    if (next > notesClosed && card.current) card.current.style.visibility = "visible"
    if (bar.current) bar.current.style.height = `${next}px`
  }
  function animate(enabled: boolean) {
    if (settle.current !== null) clearTimeout(settle.current)
    const element = bar.current
    if (!element) return
    const moving = enabled && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    element.dataset.settling = String(moving)
    if (!moving) element.getAnimations?.().forEach((animation) => animation.cancel())
    if (moving)
      settle.current = setTimeout(() => {
        element.dataset.settling = "false"
        element.dispatchEvent(new Event("notes-rest", { bubbles: true }))
      }, 300)
  }
  useLayoutEffect(() => {
    const element = bar.current
    if (!element) return
    const opacity = () => {
      if (card.current) {
        const progress = notesOpacity(element.getBoundingClientRect().height)
        card.current.style.opacity = String(progress)
        card.current.style.visibility = progress === 0 ? "hidden" : "visible"
      }
    }
    opacity()
    const observer = new ResizeObserver(opacity)
    observer.observe(element)
    return () => {
      observer.disconnect()
      if (settle.current !== null) clearTimeout(settle.current)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [])
  function finish(cancelled: boolean) {
    const current = drag.current
    if (!current) return
    drag.current = null
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    if (bar.current) delete bar.current.dataset.dragging
    suppressClick.current = !cancelled && current.moved
    if (!current.moved) return
    const tracked = trackNotesHeight(current.raw, maximum)
    paint(tracked)
    bar.current?.getBoundingClientRect()
    const target = cancelled
      ? current.open
        ? height
        : notesClosed
      : releaseNotesHeight(tracked, notesVelocity(current.samples), maximum)
    animate(true)
    paint(target)
    setOpen(target !== notesClosed)
    if (target !== notesClosed) setHeight(target)
  }
  return (
    <div
      ref={bar}
      className="notes-bar pointer-events-auto flex flex-col gap-2"
      data-notes-bar
      style={{ height: open ? height : notesClosed }}
    >
      <span id={description} hidden>
        Drag to resize presenter notes. Arrow Up and Arrow Down resize by 24 pixels. Home sets the minimum. End sets the
        maximum.
        {open ? ` Height ${Math.round(height)} pixels.` : " Collapsed."}
      </span>
      <button
        ref={expand}
        type="button"
        className="notes-handle relative mx-auto flex h-6 w-24 shrink-0 touch-none cursor-ns-resize items-center justify-center"
        aria-label={open ? "Collapse presenter notes" : "Expand presenter notes"}
        aria-expanded={open}
        aria-describedby={description}
        onClick={(event) => {
          if (suppressClick.current) {
            suppressClick.current = false
            return
          }
          animate(event.detail !== 0)
          paint(open ? notesClosed : height)
          toggle(!open)
        }}
        onPointerDown={(event) => {
          toggled.current = false
          if (event.button !== 0 || drag.current) return
          suppressClick.current = false
          event.currentTarget.setPointerCapture(event.pointerId)
          const rendered = bar.current?.getBoundingClientRect().height || (open ? height : notesClosed)
          animate(false)
          paint(rendered)
          if (bar.current) bar.current.dataset.dragging = "true"
          const raw = rawNotesHeight(rendered, maximum)
          drag.current = {
            id: event.pointerId,
            y: event.clientY,
            height: raw,
            open,
            moved: false,
            raw,
            samples: [{ y: event.clientY, at: event.timeStamp }],
          }
        }}
        onPointerMove={(event) => {
          const current = drag.current
          if (!current || current.id !== event.pointerId) return
          const distance = current.y - event.clientY
          current.moved ||= Math.abs(distance) >= 4
          current.samples.push({ y: event.clientY, at: event.timeStamp })
          current.samples = current.samples.filter((sample) => sample.at >= event.timeStamp - 100)
          current.raw = current.height + distance
          if (frame.current === null)
            frame.current = requestAnimationFrame(() => {
              frame.current = null
              paint(trackNotesHeight(current.raw, maximum))
            })
        }}
        onPointerUp={(event) => {
          drag.current?.samples.push({ y: event.clientY, at: event.timeStamp })
          finish(false)
        }}
        onPointerCancel={() => finish(true)}
        onLostPointerCapture={() => finish(true)}
        onKeyDown={(event) => {
          const next =
            event.key === "Home"
              ? notesMinimum
              : event.key === "End"
                ? maximum
                : event.key === "ArrowUp"
                  ? height + 24
                  : event.key === "ArrowDown"
                    ? height - 24
                    : null
          if (next === null) return
          event.preventDefault()
          toggled.current = false
          animate(false)
          paint(clampNotesHeight(next, maximum))
          setHeight(clampNotesHeight(next, maximum))
          setOpen(true)
        }}
      >
        <span className="flex h-6 w-24 shrink-0 items-center justify-center">
          <span className="block h-1 w-12 rounded-full notes-pill" />
        </span>
      </button>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div ref={card} className="notes-card flex h-full min-h-32 flex-col rounded-[var(--shape-card)] bg-line p-4">
          <textarea
            ref={field}
            id="speaker-notes"
            aria-label="Presenter notes"
            className="block min-h-0 w-full flex-1 resize-none overflow-auto bg-transparent text-[length:var(--type-dense)] text-ink outline-none placeholder:text-quiet"
            value={text}
            readOnly={onEdit === undefined}
            placeholder="Add presenter notes"
            data-focus-edge
            onChange={(event) => onEdit?.(event.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
