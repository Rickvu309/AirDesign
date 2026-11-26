import type * as doom from "@airdesign/doom"
import { useEffect, useRef, useState } from "react"
import { agentSlide } from "./agent-arrivals"

export function useAgentSlide(
  view: doom.Doom,
  caught: () => doom.Rev,
  held: boolean,
  show: (slide: doom.NodeId) => void,
) {
  const pressed = useRef(false)
  useEffect(() => {
    const press = (event: PointerEvent) => {
      pressed.current = event.target instanceof Element && event.target.closest("[data-canvas-stage]") !== null
    }
    const lift = () => {
      pressed.current = false
    }
    window.addEventListener("pointerdown", press, true)
    window.addEventListener("pointerup", lift, true)
    window.addEventListener("pointercancel", lift, true)
    return () => {
      window.removeEventListener("pointerdown", press, true)
      window.removeEventListener("pointerup", lift, true)
      window.removeEventListener("pointercancel", lift, true)
    }
  }, [])
  const [seen, setSeen] = useState(view)
  if (seen === view) return
  setSeen(view)
  const made = held || pressed.current ? undefined : agentSlide(seen, view, caught())
  if (made !== undefined) show(made)
}
