import { useState } from "react"

export type ShownPanel = "agent" | "design"

function stored(deck: string): string {
  return `airdesign.panel.${deck}`
}

export function keptPanel(deck: string): ShownPanel {
  try {
    return localStorage.getItem(stored(deck)) === "design" ? "design" : "agent"
  } catch {
    return "agent"
  }
}

export function keepPanel(deck: string, panel: ShownPanel): void {
  try {
    localStorage.setItem(stored(deck), panel)
  } catch {
    return
  }
}

export function useKeptPanel(deck: string, shown?: ShownPanel): [ShownPanel, (panel: ShownPanel) => void] {
  const [panel, setPanel] = useState(() => shown ?? keptPanel(deck))
  return [
    panel,
    (next) => {
      keepPanel(deck, next)
      setPanel(next)
    },
  ]
}

export type PanelView = "slides" | "grid"

function storedOpen(view: PanelView): string {
  return `airdesign.panel-open.${view}`
}

export function keptOpen(view: PanelView): boolean {
  try {
    const kept = localStorage.getItem(storedOpen(view))
    return kept === null ? view === "slides" : kept === "open"
  } catch {
    return view === "slides"
  }
}

export function useKeptOpen(view: PanelView): [boolean, (open: boolean) => void] {
  const [opens, setOpens] = useState(() => ({ slides: keptOpen("slides"), grid: keptOpen("grid") }))
  return [
    opens[view],
    (open) => {
      try {
        localStorage.setItem(storedOpen(view), open ? "open" : "closed")
      } catch {
        void 0
      }
      setOpens((held) => ({ ...held, [view]: open }))
    },
  ]
}
