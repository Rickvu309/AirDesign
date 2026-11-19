import { gestureFor } from "@airdesign/render"
import { useEffect, useRef } from "react"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import type { LayerFlag } from "@/editor/layer-flags"
import { typing } from "@/editor/pointer-tool"

const flagOfGesture = { hide: "hidden", lock: "locked" } as const satisfies Readonly<Record<string, LayerFlag>>

export function useLayerKeys(working: boolean, onFlag: (flag: LayerFlag) => void) {
  const latest = useRef(onFlag)
  useEffect(() => {
    latest.current = onFlag
  })
  useEffect(() => {
    if (!working) return
    function listen(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.defaultPrevented || typing(event.target)) return
      const gesture = gestureFor(event, "editor")
      if ((gesture !== "hide" && gesture !== "lock") || !editorOwnsKey(event)) return
      event.preventDefault()
      latest.current(flagOfGesture[gesture])
    }
    window.addEventListener("keydown", listen)
    return () => window.removeEventListener("keydown", listen)
  }, [working])
}
