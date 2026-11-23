import { gestureFor, type GestureId } from "@/lib/gestures"

export type SlideKey = "remove" | "clone" | "up" | "down"

const slideKeys: Partial<Record<GestureId, SlideKey>> = {
  "slide-delete": "remove",
  "slide-duplicate": "clone",
  "slide-up": "up",
  "slide-down": "down",
}

export function slideKey(event: {
  readonly key: string
  readonly code?: string
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
}): SlideKey | null {
  const gesture = gestureFor(event, "slides")
  return gesture === null ? null : (slideKeys[gesture] ?? null)
}
