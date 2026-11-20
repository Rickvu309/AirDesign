import { fontNames } from "@airdesign/fonts"
import { useEffect, useState } from "react"
import type { PanelControl } from "./panel"
import { servedFaces, useServedFaces } from "./served-faces"

export function useFaceFallback(control: PanelControl, onChange: (value: unknown) => void): (typed: string) => void {
  const [awaiting, setAwaiting] = useState<string | null>(null)
  useServedFaces()
  useEffect(() => {
    if (awaiting === null || control.value !== awaiting || servedFaces(awaiting) === undefined) return
    setAwaiting(null)
    const fallback = control.faceFallback?.() ?? null
    if (fallback !== null) onChange(fallback)
  })
  return (typed) => {
    const family = fontNames.find((name) => name.toLowerCase() === typed.toLowerCase())
    if (family !== undefined && servedFaces(family) === undefined) setAwaiting(family)
  }
}
