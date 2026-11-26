import type * as doom from "@airdesign/doom"
import { useEffect, useRef, useState } from "react"
import { agentSlide } from "./agent-arrivals"

export function useAgentSlide(
  view: doom.Doom,
  caught: () => doom.Rev,
  held: boolean,
  show: (slide: doom.NodeId) => void,
) {
  const pressed = useRef(new Set<number>())
  useEffect(() => {
    const down = pressed.current
    const press = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-canvas-stage]") !== null)
        down.add(event.pointerId)
    }
    const lift = (event: PointerEvent) => down.delete(event.pointerId)
    const clear = () => down.clear()
    window.addEventListener("pointerdown", press, true)
    window.addEventListener("pointerup", lift, true)
    window.addEventListener("pointercancel", lift, true)
    window.addEventListener("blur", clear)
    return () => {
      window.removeEventListener("pointerdown", press, true)
      window.removeEventListener("pointerup", lift, true)
      window.removeEventListener("pointercancel", lift, true)
      window.removeEventListener("blur", clear)
    }
  }, [])
  const [seen, setSeen] = useState(view)
  if (seen === view) return
  setSeen(view)
  const made = held || pressed.current.size > 0 ? undefined : agentSlide(seen, view, caught())
  if (made !== undefined) show(made)
}
