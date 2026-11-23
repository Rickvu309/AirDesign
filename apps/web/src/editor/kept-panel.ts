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
