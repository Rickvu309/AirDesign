import { useLayoutEffect, useRef, type ReactNode } from "react"
import type { SlidePaint } from "@/present/present-stage"
import type { Leaving } from "@/present/use-leaving"

function play(node: HTMLElement | null, frames: readonly Keyframe[] | null, duration: number) {
  if (node === null || frames === null || typeof node.animate !== "function") return null
  for (const running of node.getAnimations()) running.cancel()
  return node.animate([...frames], { duration, easing: "ease-in-out" })
}

export function TransitionLayers({
  at,
  width,
  paint,
  leaving,
  onDone,
}: {
  at: number
  width: number
  paint: SlidePaint
  leaving: Leaving | null
  onDone: () => void
}): ReactNode {
  const incoming = useRef<HTMLDivElement>(null)
  const outgoing = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (leaving === null) return
    const { frames } = leaving
    const entered = play(incoming.current, frames.incoming, frames.duration)
    play(outgoing.current, frames.outgoing, frames.duration)
    if (entered === null) {
      onDone()
      return
    }
    let live = true
    void entered.finished.then(
      () => {
        if (live) onDone()
      },
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [leaving, onDone])
  return (
    <>
      {leaving === null ? null : (
        <div ref={outgoing} className="absolute inset-0" data-present-leaving={leaving.from + 1}>
          {paint(leaving.from, width)}
        </div>
      )}
      <div ref={incoming} className="relative size-full">
        {paint(at, width)}
      </div>
    </>
  )
}
