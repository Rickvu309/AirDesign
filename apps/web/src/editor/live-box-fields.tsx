import { createContext, useCallback, useContext, useSyncExternalStore } from "react"
import { type Box, type ElementId } from "@airdesign/document"
import type { PaintStore } from "@airdesign/render"
import type { PanelControl } from "@/design/panel"

type LiveBoxes = { readonly store: PaintStore; readonly nodes: readonly ElementId[] }

const LiveBoxesContext = createContext<LiveBoxes | null>(null)

const sides: Readonly<Record<string, keyof Box>> = { x: "x", y: "y", w: "cx", h: "cy" }

const unsubscribed = () => () => undefined

export const followsDrag = (control: PanelControl): boolean =>
  control.trait === "box" && sides[control.field] !== undefined

export function useLiveBoxControl(control: PanelControl): PanelControl {
  const live = useContext(LiveBoxesContext)
  const side = followsDrag(control) ? sides[control.field] : undefined
  const watched = live !== null && side !== undefined ? live : null
  const subscribe = useCallback(
    (listener: () => void) => {
      if (watched === null) return unsubscribed()
      const stops = watched.nodes.map((node) => watched.store.boxSubscribe(node)(listener))
      return () => {
        for (const stop of stops) stop()
      }
    },
    [watched],
  )
  const read = () =>
    watched === null || side === undefined
      ? ""
      : watched.nodes.map((node) => String(watched.store.getBox(node)?.[side] ?? "")).join(" ")
  const shown = useSyncExternalStore(subscribe, read, read)
  if (shown === "") return control
  const values = shown.split(" ")
  if (values.includes("")) return control
  const mixed = values.some((value) => value !== values[0])
  return { ...control, value: mixed ? undefined : Number(values[0]), mixed }
}
