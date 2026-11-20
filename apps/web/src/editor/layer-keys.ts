import { gestureFor } from "@airdesign/render"
import { useEffect, useRef } from "react"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import type { LayerFlag } from "@/editor/layer-flags"
import { typing } from "@/editor/pointer-tool"

const flagOfGesture = { hide: "hidden", lock: "locked" } as const satisfies Readonly<Record<string, LayerFlag>>

export type LayerKeyActions = {
  readonly onFlag: (flag: LayerFlag) => void
  readonly onRename: () => boolean
}

function editorOpen(): boolean {
  if (document.querySelector('[role="dialog"][data-open], [role="alertdialog"][data-open]') !== null) return false
  if (document.querySelector("[data-grid-viewport]") !== null) return false
  const slide = document.querySelector("[data-slide-paint]")
  return slide === null || slide.closest("[inert]") === null
}

export function useLayerKeys(working: boolean, actions: LayerKeyActions) {
  const latest = useRef(actions)
  useEffect(() => {
    latest.current = actions
  })
  useEffect(() => {
    if (!working) return
    function listen(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.defaultPrevented || typing(event.target)) return
      const gesture = gestureFor(event, "editor")
      if (gesture === "hide" || gesture === "lock") {
        if (!editorOwnsKey(event)) return
        event.preventDefault()
        latest.current.onFlag(flagOfGesture[gesture])
        return
      }
      if (gesture !== "rename") return
      if (!editorOpen() || !editorOwnsKey(event)) return
      if (latest.current.onRename()) event.preventDefault()
    }
    window.addEventListener("keydown", listen)
    return () => window.removeEventListener("keydown", listen)
  }, [working])
}
