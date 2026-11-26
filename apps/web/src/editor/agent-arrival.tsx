import type * as doom from "@airdesign/doom"
import { useLayoutEffect, useRef, type RefObject } from "react"
import { agentArrivals, agentSlide, agentSlides } from "./agent-arrivals"
import { playArrival, reducedMotion, type Playing } from "./trace-spark"

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
    if ((made.size === 0 && changed.size === 0 && !drawn) || reducedMotion().matches) return
    const first = drawn ? 1 : 0
    if (drawn) {
      playing.current.get(slide)?.stop()
      const surface = host.parentElement?.querySelector<HTMLElement>("[data-slide-paint]") ?? host
      const border = playArrival(host, surface, "slide", 0)
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
        playing.current.get(id)?.stop()
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
    const motion = reducedMotion()
    motion.addEventListener("change", stop)
    return () => {
      motion.removeEventListener("change", stop)
      stop()
    }
  }, [still])

  useLayoutEffect(() => {
    const running = playing.current
    const show = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest("[data-canvas-stage]") === null) return
      running.get(slide)?.stop()
      running.delete(slide)
    }
    window.addEventListener("pointerdown", show, true)
    return () => window.removeEventListener("pointerdown", show, true)
  }, [slide])

  return (
    <div
      ref={layer}
      aria-hidden
      data-agent-arrival=""
      className="pointer-events-none absolute inset-0 overflow-hidden print:hidden"
    />
  )
}

export type StripArrival = {
  readonly view: doom.Doom
  readonly caught: () => doom.Rev
  readonly still: string
}

export function useThumbArrival(list: RefObject<HTMLDivElement | null>, arrival: StripArrival | undefined) {
  const seen = useRef<doom.Doom | null>(null)
  const playing = useRef(new Map<doom.NodeId, { readonly host: HTMLElement; readonly play: Playing }>())

  useLayoutEffect(() => {
    if (arrival === undefined) return
    const before = seen.current
    seen.current = arrival.view
    const hostList = list.current
    if (before === null || hostList === null) return
    const made = agentSlides(before, arrival.view, arrival.caught())
    for (const [id, each] of playing.current)
      if (made.has(id) || !each.host.isConnected || each.host.dataset.thumbArrival !== id) {
        each.play.stop()
        playing.current.delete(id)
      }
    if (made.size === 0 || reducedMotion().matches) return
    const hosts = new Map<doom.NodeId, HTMLElement>()
    for (const node of hostList.querySelectorAll<HTMLElement>("[data-thumb-arrival]")) {
      const id = node.dataset.thumbArrival as doom.NodeId | undefined
      if (id !== undefined) hosts.set(id, node)
    }
    let order = 0
    for (const id of made) {
      const host = hosts.get(id)
      const thumb = host?.parentElement?.querySelector<HTMLElement>("[data-slide-thumb]") ?? null
      if (host === undefined || thumb === null) continue
      const play = playArrival(host, thumb, "thumb", order)
      order += 1
      const entry = { host, play }
      playing.current.set(id, entry)
      void play.ended.then(() => {
        if (playing.current.get(id) === entry) playing.current.delete(id)
      })
    }
  }, [list, arrival?.view, arrival?.caught])

  useLayoutEffect(() => {
    const running = playing.current
    const stop = () => {
      for (const each of running.values()) each.play.stop()
      running.clear()
    }
    const motion = reducedMotion()
    motion.addEventListener("change", stop)
    return () => {
      motion.removeEventListener("change", stop)
      stop()
    }
  }, [arrival?.still])
}
