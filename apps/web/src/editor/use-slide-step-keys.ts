import * as doom from "@airdesign/doom"
import { gestureFor } from "@/lib/gestures"
import { useEffect, useRef } from "react"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { typing } from "./use-canvas-keys"

export function useSlideStepKeys(args: {
  readonly slides: readonly doom.NodeId[]
  readonly current: doom.NodeId | undefined
  readonly paused: boolean
  readonly onCurrent: (slide: doom.NodeId) => void
}) {
  const latest = useRef(args)
  useEffect(() => {
    latest.current = args
  })
  useEffect(() => {
    function down(event: KeyboardEvent) {
      const { slides, current, paused, onCurrent } = latest.current
      if (paused || event.isComposing || typing(event.target)) return
      const gesture = gestureFor(event, "slides")
      if (gesture !== "slide-previous" && gesture !== "slide-next") return
      if (!editorOwnsKey(event)) return
      const at = current === undefined ? -1 : slides.indexOf(current)
      const target = slides[gesture === "slide-previous" ? at - 1 : at + 1]
      event.preventDefault()
      if (target !== undefined) onCurrent(target)
    }
    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  }, [])
}
