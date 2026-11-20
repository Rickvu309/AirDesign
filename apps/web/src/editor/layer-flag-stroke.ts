import type { ElementId } from "@airdesign/document"
import { useEffect, useRef, useState } from "react"
import type { LayerFlag } from "@/editor/layer-flags"

export type FlagStroke = { readonly flag: LayerFlag; readonly on: boolean; readonly nodes: readonly ElementId[] }

export function useFlagStroke(
  onFlag: ((nodes: readonly ElementId[], flag: LayerFlag, on: boolean) => void) | undefined,
) {
  const [stroke, setStroke] = useState<FlagStroke | null>(null)
  const held = useRef<FlagStroke | null>(null)
  const commit = useRef(onFlag)
  commit.current = onFlag
  useEffect(() => {
    if (stroke === null) return
    const finish = () => {
      const done = held.current
      held.current = null
      setStroke(null)
      if (done !== null && done.nodes.length > 0) commit.current?.(done.nodes, done.flag, done.on)
    }
    window.addEventListener("pointerup", finish)
    window.addEventListener("pointercancel", finish)
    return () => {
      window.removeEventListener("pointerup", finish)
      window.removeEventListener("pointercancel", finish)
    }
  }, [stroke])

  function hold(next: FlagStroke) {
    held.current = next
    setStroke(next)
  }

  return {
    start(node: ElementId, flag: LayerFlag, on: boolean) {
      hold({ flag, on, nodes: [node] })
    },
    enter(node: ElementId, flag: LayerFlag, now: boolean) {
      const current = held.current
      if (current === null || current.flag !== flag || now === current.on || current.nodes.includes(node)) return
      hold({ ...current, nodes: [...current.nodes, node] })
    },
    shown(node: ElementId, flag: LayerFlag, now: boolean): boolean {
      return stroke !== null && stroke.flag === flag && stroke.nodes.includes(node) ? stroke.on : now
    },
  }
}
