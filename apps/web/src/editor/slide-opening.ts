import { flushSync } from "react-dom"

function still(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function openWith(change: () => void): void {
  if (typeof document === "undefined" || typeof document.startViewTransition !== "function" || still()) {
    change()
    return
  }
  document.startViewTransition(() => flushSync(change))
}
