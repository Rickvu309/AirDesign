import { useLayoutEffect, useRef, type ReactNode } from "react"
import type { SlidePaint } from "@/present/present-stage"
import type { Leaving } from "@/present/use-leaving"

function play(node: HTMLElement | null, frames: readonly Keyframe[] | null, duration: number, easing: string) {
  if (node === null || frames === null || typeof node.animate !== "function") return null
  for (const running of node.getAnimations()) running.cancel()
  return node.animate([...frames], { duration, easing })
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
    const entered = play(incoming.current, frames.incoming, frames.duration, frames.easing)
    const exited = play(outgoing.current, frames.outgoing, frames.duration, frames.easing)
    const lead = frames.incoming === null ? exited : entered
    if (lead === null) {
      onDone()
      return
    }
    let live = true
    void lead.finished.then(
      () => {
        if (live) onDone()
      },
      () => undefined,
    )
    return () => {
      live = false
      entered?.cancel()
      exited?.cancel()
    }
  }, [leaving, onDone])
  return (
    <>
      {leaving === null ? null : (
        <div
          ref={outgoing}
          className={leaving.frames.outgoingOnTop === true ? "absolute inset-0 z-10" : "absolute inset-0"}
          data-present-leaving={leaving.from + 1}
        >
          {paint(leaving.from, width)}
        </div>
      )}
      <div ref={incoming} className="relative size-full">
        {paint(at, width)}
      </div>
    </>
  )
}
