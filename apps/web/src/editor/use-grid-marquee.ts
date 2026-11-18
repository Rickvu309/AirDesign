import type { Selection } from "@airdesign/render"
import { createElement, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react"
import { flushSync } from "react-dom"
import { slideListCopy } from "@/copy/slide-list-copy"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { edgePan, type GridSlot } from "@/editor/grid-drop"
import { gridBlank } from "@/editor/grid-hit"
import { gridEditing, gridStep, type GridInteraction, type GridStep } from "@/editor/grid-interaction"
import { marqueeBox, marqueeHits, marqueeStarted, marqueeStep, type MarqueeDeck } from "@/editor/grid-marquee"
import { pickedSlides, toggledCurrent } from "@/editor/grid-selection"
import type { SlideStrip } from "@/editor/slide-sidebar"
import { slotsIn, swallowClick } from "@/editor/use-grid-drag"
import type { useGridEditing } from "@/editor/use-grid-editing"
import type { useGridViewport } from "@/editor/use-grid-viewport"

type Point = { readonly x: number; readonly y: number }

type Press = {
  readonly pointer: number
  readonly from: Point
  readonly start: Point
  readonly client: Point
  readonly adding: boolean
  readonly before: GridInteraction
  readonly selection: Selection
  readonly deck: MarqueeDeck
  readonly faces: readonly GridSlot[] | null
  readonly hits: readonly number[]
  readonly cancelled: boolean
}

const frameTime = 1000 / 60

function scaleOf(world: HTMLElement, box: DOMRect): number {
  return world.offsetWidth === 0 ? 1 : box.width / world.offsetWidth
}

function inWorld(world: HTMLElement, point: Point): Point {
  const box = world.getBoundingClientRect()
  const scale = scaleOf(world, box)
  return { x: (point.x - box.left) / scale, y: (point.y - box.top) / scale }
}

export function useGridMarquee({
  list,
  viewport,
  edit,
  strip,
  state,
  selection,
  select,
  hand,
  announce,
}: {
  list: RefObject<HTMLDivElement | null>
  viewport: Pick<ReturnType<typeof useGridViewport>, "handlers" | "panBy" | "panEnd" | "focus">
  edit: Pick<ReturnType<typeof useGridEditing>, "step">
  strip: Pick<SlideStrip, "current" | "count" | "slideIds" | "onSelect">
  state: GridInteraction
  selection: Selection
  select: (selection: Selection) => void
  hand: boolean
  announce: (text: string) => void
}) {
  const press = useRef<Press | null>(null)
  const mark = useRef<HTMLDivElement>(null)
  const frame = useRef<number | null>(null)
  const clock = useRef(0)
  const [active, setActive] = useState(false)

  function apply(held: Press, next: GridStep) {
    edit.step(next)
    if (next.kind === "restore" && gridEditing(next.state)) select(held.selection)
  }

  function draw(held: Press) {
    const world = list.current
    const host = viewport.handlers.ref.current
    const shape = mark.current
    if (world === null || host === null || shape === null || held.faces === null) return
    const area = marqueeBox(held.start, inWorld(world, held.client))
    const box = world.getBoundingClientRect()
    const room = host.getBoundingClientRect()
    const scale = scaleOf(world, box)
    shape.hidden = false
    shape.style.transform = `translate(${box.left - room.left + area.left * scale}px, ${box.top - room.top + area.top * scale}px)`
    shape.style.width = `${(area.right - area.left) * scale}px`
    shape.style.height = `${(area.bottom - area.top) * scale}px`
    const hits = marqueeHits(area, held.faces)
    if (hits.join(",") === held.hits.join(",")) return
    press.current = { ...held, hits }
    apply(held, marqueeStep(held.before, held.deck, hits, held.adding))
  }

  function end() {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    if (mark.current !== null) mark.current.hidden = true
    viewport.panEnd()
    setActive(false)
  }

  function finish(held: Press) {
    const next = gridStep(held.before, marqueeStep(held.before, held.deck, held.hits, held.adding))
    if (next.kind === "none") {
      list.current?.focus({ preventScroll: true, focusVisible: false })
      if (held.before.kind !== "none") announce(slideListCopy.nothingSelected)
      return
    }
    if (next.kind !== "slides") return
    const current = toggledCurrent(next.pick, held.deck.current)
    if (current !== strip.current) flushSync(() => strip.onSelect(current))
    const card = list.current?.querySelector<HTMLElement>(`[data-slide-entry="${String(current + 1)}"]`)
    if (card !== null && card !== undefined) viewport.focus(card)
    announce(slideListCopy.selected(pickedSlides(next.pick, current).length))
  }

  function step(time: number) {
    const held = press.current
    const host = viewport.handlers.ref.current
    if (held === null || held.faces === null || held.cancelled || host === null) {
      frame.current = null
      return
    }
    const beats = Math.min(4, (time - clock.current) / frameTime)
    clock.current = time
    const speed = edgePan(held.client, host.getBoundingClientRect())
    if (speed.x !== 0 || speed.y !== 0) {
      viewport.panBy({ x: speed.x * beats, y: speed.y * beats })
      draw(held)
    }
    frame.current = requestAnimationFrame((next) => latest.current.step(next))
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary || event.pointerType === "touch" || hand) return
    if ((press.current !== null && !press.current.cancelled) || !gridBlank(event.target) || list.current === null)
      return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const from = { x: event.clientX, y: event.clientY }
    press.current = {
      pointer: event.pointerId,
      from,
      start: inWorld(list.current, from),
      client: from,
      adding: event.shiftKey || event.metaKey || event.ctrlKey,
      before: state,
      selection,
      deck: { current: strip.current, count: strip.count, ...(strip.slideIds ? { ids: strip.slideIds } : {}) },
      faces: null,
      hits: [],
      cancelled: false,
    }
  }

  function follow(event: globalThis.PointerEvent) {
    const held = press.current
    if (held === null || held.pointer !== event.pointerId || held.cancelled) return
    const client = { x: event.clientX, y: event.clientY }
    if (held.faces === null && !marqueeStarted(held.from, client)) return
    const world = list.current
    const moved = { ...held, client, faces: held.faces ?? (world === null ? [] : slotsIn(world)) }
    press.current = moved
    if (held.faces === null) {
      setActive(true)
      document.getSelection()?.removeAllRanges()
      frame.current = requestAnimationFrame((time) => {
        clock.current = time
        latest.current.step(time)
      })
    }
    draw(moved)
  }

  function release(event: globalThis.PointerEvent) {
    const held = press.current
    if (held === null || held.pointer !== event.pointerId) return
    press.current = null
    if (held.faces === null) {
      viewport.handlers.ref.current?.focus({ preventScroll: true, focusVisible: false })
      return
    }
    swallowClick()
    if (held.cancelled) return
    end()
    finish(held)
  }

  function escape(event: globalThis.KeyboardEvent) {
    const held = press.current
    if (!editorOwnsKey(event) || event.key !== "Escape" || held === null || held.faces === null || held.cancelled)
      return
    event.preventDefault()
    event.stopPropagation()
    press.current = { ...held, cancelled: true }
    end()
    apply(held, { kind: "restore", state: held.before })
  }

  function lose() {
    const held = press.current
    if (held === null || held.cancelled) return
    if (held.faces === null) {
      press.current = null
      return
    }
    press.current = { ...held, cancelled: true }
    end()
    apply(held, { kind: "restore", state: held.before })
  }

  const latest = useRef({ step, follow, release, escape, lose })
  latest.current = { step, follow, release, escape, lose }

  useEffect(() => {
    const follow = (event: globalThis.PointerEvent) => latest.current.follow(event)
    const release = (event: globalThis.PointerEvent) => latest.current.release(event)
    const cancel = (event: globalThis.PointerEvent) => {
      if (press.current?.pointer === event.pointerId) latest.current.lose()
    }
    const escape = (event: globalThis.KeyboardEvent) => latest.current.escape(event)
    const lose = () => latest.current.lose()
    window.addEventListener("pointermove", follow)
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", cancel)
    window.addEventListener("keydown", escape, true)
    window.addEventListener("blur", lose)
    return () => {
      window.removeEventListener("pointermove", follow)
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", cancel)
      window.removeEventListener("keydown", escape, true)
      window.removeEventListener("blur", lose)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [])

  return {
    active,
    press: down,
    box: createElement("div", { ref: mark, hidden: true, "aria-hidden": true, "data-grid-marquee": "" }),
  }
}
