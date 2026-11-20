import { useState } from "react"

export type ViewSetting = "rulers"

function stored(setting: ViewSetting): string {
  return `airdesign.view.${setting}`
}

export function keptView(setting: ViewSetting): boolean {
  try {
    return localStorage.getItem(stored(setting)) === "shown"
  } catch {
    return false
  }
}

function keepView(setting: ViewSetting, shown: boolean): void {
  try {
    if (shown) localStorage.setItem(stored(setting), "shown")
    else localStorage.removeItem(stored(setting))
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
