import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import type { Props } from "@airdesign/doom"
import type { SlideSize } from "@/editing/canvas-zoom"
import type { SlidePaint } from "@/present/present-stage"
import { morphLayers } from "@/present/morph-layers"
import type { LayerPairs } from "@/present/morph-pairs"
import { playedFrames, type TransitionFrames } from "@/present/slide-transition"

type Moving = { readonly frames: TransitionFrames; readonly pairs: LayerPairs }

type Shown = {
  readonly front: number
  readonly target: number
  readonly waiting: boolean
  readonly moving: Moving | null
}

const settled = (at: number): Shown => ({ front: at, target: at, waiting: false, moving: null })

function stillPreferred(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function play(node: HTMLElement | null, frames: readonly Keyframe[] | null, duration: number, easing: string) {
  if (node === null || frames === null || typeof node.animate !== "function") return null
  for (const running of node.getAnimations()) running.cancel()
  return node.animate([...frames], { duration, easing })
}

function painted(root: HTMLElement): boolean {
  return root.querySelector("[data-fonts-pending]") === null
}

function whenPainted(root: HTMLElement | null, then: () => void): () => void {
  if (root === null) return () => undefined
  if (painted(root)) {
    then()
    return () => undefined
  }
  const watch = new MutationObserver(() => {
    if (!painted(root)) return
    watch.disconnect()
    then()
  })
  watch.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-fonts-pending"] })
  return () => watch.disconnect()
}

export function TransitionLayers({
  at,
  width,
  size,
  paint,
  transitionOf,
  morphOf,
}: {
  at: number
  width: number
  size: SlideSize
  paint: SlidePaint
  transitionOf: (index: number) => Props["transition"] | null
  morphOf: (from: number, to: number) => LayerPairs
}): ReactNode {
  const [shown, setShown] = useState(() => settled(at))
  if (shown.target !== at) {
    const front = shown.waiting ? shown.front : shown.target
    setShown(at === front ? settled(at) : { front, target: at, waiting: true, moving: null })
  }
  const incoming = useRef<HTMLDivElement>(null)
  const outgoing = useRef<HTMLDivElement>(null)
  const above = useRef<HTMLDivElement>(null)
  const { front, target, waiting, moving } = shown

  useLayoutEffect(() => {
    if (!waiting) return
    return whenPainted(incoming.current, () => {
      const transition = target > front ? transitionOf(target) : null
      const frames = transition === null ? null : playedFrames(transition, stillPreferred())
      const next: Shown =
        frames === null
          ? settled(target)
          : {
              front,
              target,
              waiting: false,
              moving: { frames, pairs: frames.morph === true ? morphOf(front, target) : [] },
            }
      setShown((now) => (now.target === target && now.front === front && now.waiting ? next : now))
    })
  }, [front, target, waiting, transitionOf, morphOf])

  useLayoutEffect(() => {
    if (moving === null) return
    const { frames } = moving
    const finish = () => setShown((now) => (now.moving === moving ? settled(now.target) : now))
    const settle =
      frames.morph === true && outgoing.current !== null && incoming.current !== null && above.current !== null
        ? morphLayers(outgoing.current, incoming.current, above.current, moving.pairs, frames)
        : () => undefined
    const entered = play(incoming.current, frames.incoming, frames.duration, frames.easing)
    const exited = play(outgoing.current, frames.outgoing, frames.duration, frames.easing)
    if (entered === null) {
      settle()
      finish()
      return
    }
    let live = true
    void entered.finished.then(
      () => {
        if (live) finish()
      },
      () => undefined,
    )
    return () => {
      live = false
      entered.cancel()
      exited?.cancel()
      settle()
    }
  }, [moving])

  const layers = front === target ? [target] : [front, target]
  return (
    <>
      {layers.map((index) =>
        index === target ? (
          <div
            key={index}
            ref={incoming}
            className="absolute inset-0"
            style={waiting ? { visibility: "hidden" } : undefined}
            data-present-incoming={index + 1}
          >
            {paint(index, width)}
          </div>
        ) : (
          <div key={index} ref={outgoing} className="absolute inset-0" data-present-leaving={index + 1}>
            {paint(index, width)}
          </div>
        ),
      )}
      {moving?.frames.morph === true ? (
        <div className="pointer-events-none absolute inset-0 z-20" data-present-morph>
          <div
            ref={above}
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: size.width, height: size.height, transform: `scale(${String(width / size.width)})` }}
          />
        </div>
      ) : null}
    </>
  )
}
