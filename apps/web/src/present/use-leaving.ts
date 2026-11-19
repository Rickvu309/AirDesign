import { useCallback, useState } from "react"
import type { SlideTransition } from "@airdesign/pptx"
import { playedFrames, type TransitionFrames } from "@/present/slide-transition"

export type LayerPairs = readonly (readonly [string, string])[]

export type Leaving = { readonly from: number; readonly frames: TransitionFrames; readonly pairs: LayerPairs }

function stillPreferred(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function useLeaving(
  at: number,
  transitionOf: (index: number) => SlideTransition | null,
  morphOf: (from: number, to: number) => LayerPairs = () => [],
) {
  const [shown, setShown] = useState(at)
  const [leaving, setLeaving] = useState<Leaving | null>(null)
  if (shown !== at) {
    const transition = at > shown ? transitionOf(at) : null
    const frames = transition === null ? null : playedFrames(transition, stillPreferred())
    const pairs = frames?.morph === true ? morphOf(shown, at) : []
    setLeaving(frames === null ? null : { from: shown, frames, pairs })
    setShown(at)
  }
  const done = useCallback(() => setLeaving(null), [])
  return { leaving, done }
}
