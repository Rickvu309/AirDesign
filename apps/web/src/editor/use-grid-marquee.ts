import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react"
import { gestureFor } from "@/lib/gestures"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import type { GridInteraction, GridStep } from "@/editor/grid-interaction"
import type { GridLayout } from "@/editor/grid-lines"
import {
  edgePan,
  marqueeBox,
  marqueeHits,
  marqueeStarted,
  marqueeStep,
  type MarqueeBox,
  type MarqueeDeck,
} from "@/editor/grid-marquee"
import { blankCanvas, type useGridCamera } from "@/editor/use-grid-camera"

type Point = { readonly x: number; readonly y: number }

type Press = {
  readonly pointer: number
  readonly from: Point
  readonly start: Point
  readonly client: Point
  readonly adding: boolean
  readonly before: GridInteraction
  readonly deck: MarqueeDeck
  readonly started: boolean
  readonly hits: readonly number[]
}

const frameTime = 1000 / 60

export function useGridMarquee({
  camera,
  layout,
  state,
  deck,
  hand,
  onStep,
  onEnd,
}: {
  readonly camera: Pick<ReturnType<typeof useGridCamera>, "handlers" | "panBy" | "world">
  readonly layout: GridLayout
  readonly state: GridInteraction
  readonly deck: MarqueeDeck
  readonly hand: boolean
  readonly onStep: (step: GridStep) => void
  readonly onEnd: (before: GridInteraction, deck: MarqueeDeck, hits: readonly number[], adding: boolean) => void
}) {
  const press = useRef<Press | null>(null)
  const frame = useRef<number | null>(null)
  const clock = useRef(0)
  const swallow = useRef(false)
  const [box, setBox] = useState<MarqueeBox | null>(null)

  function draw(held: Press) {
    const area = marqueeBox(held.start, camera.world(held.client))
    setBox(area)
    const hits = marqueeHits(area, layout.cards)
    if (hits.join(",") === held.hits.join(",")) return
    press.current = { ...held, hits }
    onStep(marqueeStep(held.before, held.deck, hits, held.adding))
  }

  function stop() {
    press.current = null
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    setBox(null)
  }

  function cancel() {
    const held = press.current
    if (held === null) return
    stop()
    if (!held.started) return
    swallow.current = true
    onStep({ kind: "restore", state: held.before })
  }

  function step(time: number) {
    const held = press.current
    const host = camera.handlers.ref.current
    if (held === null || host === null) {
      frame.current = null
      return
    }
    const beats = Math.min(4, (time - clock.current) / frameTime)
    clock.current = time
    const speed = edgePan(held.client, host.getBoundingClientRect())
    if (speed.x !== 0 || speed.y !== 0) {
      camera.panBy({ x: speed.x * beats, y: speed.y * beats })
      draw(held)
    }
    frame.current = requestAnimationFrame((next) => latest.current.step(next))
  }

  function follow(event: globalThis.PointerEvent) {
    const held = press.current
    if (held === null || held.pointer !== event.pointerId) return
    const client = { x: event.clientX, y: event.clientY }
    if (!held.started && !marqueeStarted(held.from, client)) return
    const moved = { ...held, client, started: true }
    press.current = moved
    if (!held.started) {
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
    stop()
    if (!held.started) return
    swallow.current = true
    onEnd(held.before, held.deck, held.hits, held.adding)
  }

  function escape(event: KeyboardEvent) {
    if (gestureFor(event, "grid") !== "deselect" || press.current?.started !== true || !editorOwnsKey(event)) return
    event.preventDefault()
    event.stopPropagation()
    cancel()
  }

  const latest = useRef({ step, follow, release, escape, cancel })
  useLayoutEffect(() => {
    latest.current = { step, follow, release, escape, cancel }
  })

  useEffect(() => {
    const follow = (event: globalThis.PointerEvent) => latest.current.follow(event)
    const release = (event: globalThis.PointerEvent) => latest.current.release(event)
    const lost = (event: globalThis.PointerEvent) => {
      if (press.current?.pointer === event.pointerId) latest.current.cancel()
    }
    const escape = (event: KeyboardEvent) => latest.current.escape(event)
    const blur = () => latest.current.cancel()
    window.addEventListener("pointermove", follow)
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", lost)
    window.addEventListener("keydown", escape, true)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("pointermove", follow)
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", lost)
      window.removeEventListener("keydown", escape, true)
      window.removeEventListener("blur", blur)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [])

  return {
    box,
    press: (event: PointerEvent<HTMLDivElement>) => {
      swallow.current = false
      if (event.button !== 0 || !event.isPrimary || event.pointerType === "touch" || hand) return
      if (press.current !== null || !blankCanvas(event.target)) return
      event.preventDefault()
      event.currentTarget.focus({ preventScroll: true })
      const from = { x: event.clientX, y: event.clientY }
      press.current = {
        pointer: event.pointerId,
        from,
        start: camera.world(from),
        client: from,
        adding: event.shiftKey || event.metaKey || event.ctrlKey,
        before: state,
        deck,
        started: false,
        hits: [],
      }
    },
    swallowedClick: () => {
      const swallowed = swallow.current
      swallow.current = false
      return swallowed
    },
  }
}
