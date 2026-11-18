import type { MouseEvent } from "react"
import { pointAt, type MenuAnchor } from "@/editor/grid-menu"

type OpenGridMenu = (index: number, anchor: MenuAnchor, pointer: boolean) => void

export function gridContextMenu(event: MouseEvent<HTMLDivElement>, index: number, open: OpenGridMenu): void {
  if (
    event.target instanceof Element &&
    event.target.closest("[data-grid-edit] [data-canvas-element], [data-grid-edit] [data-selection]") !== null
  )
    return
  event.preventDefault()
  event.currentTarget.querySelector<HTMLElement>("[data-slide-entry]")?.focus()
  open(index, pointAt(event.clientX, event.clientY), true)
}
