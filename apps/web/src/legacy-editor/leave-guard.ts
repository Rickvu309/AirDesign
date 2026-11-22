import { useEffect, useSyncExternalStore } from "react"
import type { PaintAhead } from "@/editor/painted-ahead"

export type Unsent = { readonly painting: boolean; readonly unsent: boolean }

function askToStay(event: BeforeUnloadEvent): void {
  event.preventDefault()
}

export function useLeaveGuard(pending: boolean, ahead: PaintAhead): Unsent {
  const painting = useSyncExternalStore(ahead.watch, ahead.holding)
  const unsent = pending || painting
  useEffect(() => {
    if (!unsent) return
    window.addEventListener("beforeunload", askToStay)
    return () => window.removeEventListener("beforeunload", askToStay)
  }, [unsent])
  return { painting, unsent }
}
