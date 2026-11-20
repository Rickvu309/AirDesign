import { useSyncExternalStore } from "react"
import { fontsFor } from "./font-load.js"

const watchers = new Set<() => void>()
let settling = 0

function tell(): void {
  for (const watcher of watchers) watcher()
}

export function startSettling(): () => void {
  settling += 1
  tell()
  let open = true
  return () => {
    if (!open) return
    open = false
    settling -= 1
    tell()
  }
}

function fonts() {
  return typeof document === "undefined" ? undefined : fontsFor(document)
}

const faceEvents = ["loading", "loadingdone", "loadingerror"] as const

function faces(): FontFaceSet | undefined {
  return typeof document === "undefined" ? undefined : document.fonts
}

function watch(watcher: () => void): () => void {
  watchers.add(watcher)
  const stopFonts = fonts()?.subscribe(watcher)
  for (const event of faceEvents) faces()?.addEventListener(event, watcher)
  return () => {
    watchers.delete(watcher)
    stopFonts?.()
    for (const event of faceEvents) faces()?.removeEventListener(event, watcher)
  }
}

function isSettled(): boolean {
  return settling === 0 && fonts()?.busy() !== true && faces()?.status !== "loading"
}

export function useSettled(): boolean {
  return useSyncExternalStore(watch, isSettled, () => false)
}
