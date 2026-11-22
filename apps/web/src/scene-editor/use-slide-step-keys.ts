import type { scene } from "@airdesign/document"
import { gestureFor } from "@airdesign/render"
import { useEffect, useRef } from "react"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { typing } from "./use-canvas-keys"

export function useSlideStepKeys(args: {
  readonly slides: readonly scene.NodeId[]
  readonly current: scene.NodeId | undefined
  readonly selecting: boolean
  readonly onCurrent: (slide: scene.NodeId) => void
}) {
  const latest = useRef(args)
  useEffect(() => {
    latest.current = args
  })
  useEffect(() => {
    function down(event: KeyboardEvent) {
      const { slides, current, selecting, onCurrent } = latest.current
      if (selecting || event.isComposing || typing(event.target)) return
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
