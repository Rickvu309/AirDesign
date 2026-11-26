import type * as doom from "@airdesign/doom"
import { useLayoutEffect, useRef } from "react"
import { agentArrivals, agentSlide } from "./agent-arrivals"
import { playArrival, type Playing } from "./trace-spark"

const reduced = (): Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener"> =>
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }

const idOf = (element: HTMLElement) => element.dataset.node as doom.NodeId

export function AgentArrival({
  view,
  slide,
  caught,
  still,
}: {
  readonly view: doom.Doom
  readonly slide: doom.NodeId
  readonly caught: () => doom.Rev
  readonly still: string
}) {
  const layer = useRef<HTMLDivElement>(null)
  const seen = useRef<doom.Doom | null>(null)
  const playing = useRef(new Map<doom.NodeId, Playing>())

  useLayoutEffect(() => {
    const before = seen.current
    seen.current = view
    const host = layer.current
    if (before === null || host === null) return
    const { made, changed } = agentArrivals(before, view, caught())
    const drawn = agentSlide(before, view, caught()) === slide
    for (const [id, each] of playing.current)
      if (made.has(id) || (id !== slide && view.revs.get(id) !== before.revs.get(id))) {
        each.stop()
        playing.current.delete(id)
      }
    if ((made.size === 0 && changed.size === 0 && !drawn) || reduced().matches) return
    const first = drawn ? 1 : 0
    if (drawn) {
      const border = playArrival(host, host, "slide", 0)
      playing.current.set(slide, border)
      void border.ended.then(() => {
        if (playing.current.get(slide) === border) playing.current.delete(slide)
      })
    }
    const painted = [...(host.parentElement?.querySelectorAll<HTMLElement>("[data-node]") ?? [])]
    painted
      .filter((element) => made.has(idOf(element)) || changed.has(idOf(element)))
      .forEach((element, order) => {
        const id = idOf(element)
        const each = playArrival(host, element, made.has(id) ? "made" : "changed", order + first)
        playing.current.set(id, each)
        void each.ended.then(() => {
          if (playing.current.get(id) === each) playing.current.delete(id)
        })
      })
  }, [view, slide, caught])

  useLayoutEffect(() => {
    const running = playing.current
    const stop = () => {
      for (const each of running.values()) each.stop()
      running.clear()
    }
    const motion = reduced()
    motion.addEventListener("change", stop)
    return () => {
      motion.removeEventListener("change", stop)
      stop()
    }
  }, [still])

  return (
    <div
      ref={layer}
      aria-hidden
      data-agent-arrival=""
      className="pointer-events-none absolute inset-0 overflow-hidden print:hidden"
    />
  )
}
