import type { scene } from "@airdesign/document"
import { useState } from "react"

type Held = { readonly id: scene.NodeId | null; readonly index: number }

export function useCurrentSlide(slides: readonly scene.NodeId[]) {
  const [held, setHeld] = useState<Held>({ id: null, index: 0 })
  const found = held.id === null ? -1 : slides.indexOf(held.id)
  const index = found === -1 ? Math.max(0, Math.min(held.index, slides.length - 1)) : found
  const slide = slides[index]
  if (slide !== undefined && (slide !== held.id || index !== held.index)) setHeld({ id: slide, index })
  return [slide, (id: scene.NodeId) => setHeld({ id, index: Math.max(0, slides.indexOf(id)) })] as const
}
