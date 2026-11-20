import { useState } from "react"

export type ViewSetting = "rulers" | "layoutGuides"

const shownFirst: Readonly<Record<ViewSetting, boolean>> = { rulers: false, layoutGuides: true }

function stored(setting: ViewSetting): string {
  return `airdesign.view.${setting}`
}

export function keptView(setting: ViewSetting): boolean {
  try {
    const kept = localStorage.getItem(stored(setting))
    return kept === null ? shownFirst[setting] : kept === "shown"
  } catch {
    return shownFirst[setting]
  }
}

function keepView(setting: ViewSetting, shown: boolean): void {
  try {
    if (shown === shownFirst[setting]) localStorage.removeItem(stored(setting))
    else localStorage.setItem(stored(setting), shown ? "shown" : "hidden")
  } catch {
    return
  }
}

export function useKeptView(setting: ViewSetting): [boolean, (shown: boolean) => void] {
  const [shown, setShown] = useState(() => keptView(setting))
  return [
    shown,
    (next) => {
      keepView(setting, next)
      setShown(next)
    },
  ]
}
