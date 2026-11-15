import { useCallback, useState, useSyncExternalStore } from "react"
import type { CommitOutcome } from "@/commit-edit"
import { signInAddress, type ThinNotice } from "@/thin-notice"
import type { UndoDirection } from "@/undo-list"

export type DeckFailure = "import-failed" | "export-failed" | "picture-uploading"

function watchNetwork(change: () => void): () => void {
  window.addEventListener("online", change)
  window.addEventListener("offline", change)
  return () => {
    window.removeEventListener("online", change)
    window.removeEventListener("offline", change)
  }
}

const browserOnline = () => navigator.onLine !== false

export function useDeckStatus() {
  const [paintedDeck, setPaintedDeck] = useState<string | undefined>(undefined)
  const [pending, setPending] = useState(false)
  const online = useSyncExternalStore(watchNetwork, browserOnline)
  const [offline, setOffline] = useState(() => navigator.onLine === false)
  const [failure, setFailure] = useState<DeckFailure | null>(null)
  const [refused, setRefused] = useState(false)
  const [aside, setAside] = useState(0)

  const settle = useCallback((outcome: CommitOutcome) => {
    if (outcome === "sent") {
      setPending(false)
      setAside(0)
    }
    if (outcome === "set-aside") {
      setPending(false)
      setAside((count) => count + 1)
    }
    if (outcome === "offline") setPending(true)
    if (outcome !== "refused") setOffline(outcome === "offline")
    if (outcome === "signed-out") window.location.assign(signInAddress(window.location))
  }, [])
  const leftNetwork = useCallback(() => setOffline(true), [])

  return {
    paintedDeck,
    setPaintedDeck,
    pending,
    setPending,
    online,
    offline,
    failure,
    setFailure,
    refused,
    setRefused,
    aside,
    settle,
    leftNetwork,
  }
}

export function shownNotice(shown: {
  readonly failure: DeckFailure | null
  readonly told: UndoDirection | null
  readonly picture: ThinNotice | null
  readonly online: boolean
  readonly offline: boolean
  readonly pending: boolean
  readonly aside: number
}): ThinNotice | null {
  const { failure, told, offline, pending } = shown
  const toldNotice: ThinNotice | null = told === null ? null : told === "undo" ? "undo-changed" : "redo-changed"
  const asideNotice: ThinNotice | null = shown.aside > 0 ? "set-aside" : null
  const unsentNotice: ThinNotice | null = offline && pending ? (shown.online ? "unreached" : "offline") : null
  return failure ?? toldNotice ?? shown.picture ?? asideNotice ?? unsentNotice
}
