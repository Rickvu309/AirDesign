import { useCallback, useState } from "react"
import type { SlideTransition } from "@airdesign/pptx"
import { playedFrames, type TransitionFrames } from "@/present/slide-transition"

export type Leaving = { readonly from: number; readonly frames: TransitionFrames }

function stillPreferred(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function useLeaving(at: number, transitionOf: (index: number) => SlideTransition | null) {
  const [shown, setShown] = useState(at)
  const [leaving, setLeaving] = useState<Leaving | null>(null)
  if (shown !== at) {
    const transition = at > shown ? transitionOf(at) : null
    const frames = transition === null ? null : playedFrames(transition, stillPreferred())
    setLeaving(frames === null ? null : { from: shown, frames })
    setShown(at)
  }
  const done = useCallback(() => setLeaving(null), [])
  return { leaving, done }
}
