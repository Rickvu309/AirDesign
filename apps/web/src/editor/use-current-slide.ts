import * as doom from "@airdesign/doom"
import { useEffect, useState } from "react"
import { slideAddressOf, slideAddressRead } from "./slide-address"

type Held = { readonly id: doom.NodeId | null; readonly index: number }

function addressed(): Held {
  const read = slideAddressRead(window.location.search)
  return { id: (read === null ? undefined : doom.readNodeId(read)) ?? null, index: 0 }
}

export function useCurrentSlide(slides: readonly doom.NodeId[]) {
  const [held, setHeld] = useState<Held>(addressed)
  const found = held.id === null ? -1 : slides.indexOf(held.id)
  const index = found === -1 ? Math.max(0, Math.min(held.index, slides.length - 1)) : found
  const slide = slides[index]
  if (slide !== undefined && (slide !== held.id || index !== held.index)) setHeld({ id: slide, index })
  useEffect(() => {
    if (slide === undefined) return
    const next = slideAddressOf(window.location, slide)
    if (next !== window.location.pathname + window.location.search + window.location.hash)
      window.history.replaceState(window.history.state, "", next)
  }, [slide])
  return [slide, (id: doom.NodeId) => setHeld({ id, index: Math.max(0, slides.indexOf(id)) })] as const
}
