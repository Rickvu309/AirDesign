import type * as doom from "@airdesign/doom"
import { useEffect, useLayoutEffect, useRef } from "react"
import { agentArrivals } from "./agent-arrivals"
import { playArrival, type Playing } from "./trace-spark"

const reducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

const idOf = (element: HTMLElement) => element.dataset.node as doom.NodeId

export function AgentArrival({ view, slide }: { readonly view: doom.Doom; readonly slide: doom.NodeId }) {
  const layer = useRef<HTMLDivElement>(null)
  const seen = useRef<doom.Doom | null>(null)
  const playing = useRef(new Map<doom.NodeId, Playing>())

  useLayoutEffect(() => {
    const before = seen.current
    seen.current = view
    const host = layer.current
    if (before === null || host === null) return
    const { made, changed } = agentArrivals(before, view)
    for (const [id, each] of playing.current)
      if (made.has(id) || view.revs.get(id) !== before.revs.get(id)) {
        each.stop()
        playing.current.delete(id)
      }
    if ((made.size === 0 && changed.size === 0) || reducedMotion()) return
    const painted = [...(host.parentElement?.querySelectorAll<HTMLElement>("[data-node]") ?? [])]
    painted
      .filter((element) => made.has(idOf(element)) || changed.has(idOf(element)))
      .forEach((element, order) => {
        const id = idOf(element)
        const each = playArrival(host, element, made.has(id) ? "made" : "changed", order)
        playing.current.set(id, each)
        void each.ended.then(() => {
          if (playing.current.get(id) === each) playing.current.delete(id)
        })
      })
  }, [view])

  useEffect(() => {
    const running = playing.current
    return () => {
      for (const each of running.values()) each.stop()
      running.clear()
    }
  }, [slide])

  return (
    <div
      ref={layer}
      aria-hidden
      data-agent-arrival=""
      className="pointer-events-none absolute inset-0 overflow-hidden"
    />
  )
}
