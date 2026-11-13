import { useCallback, useState } from "react"
import type { CommitOutcome } from "@/commit-edit"
import { signInAddress, type ThinNotice } from "@/thin-notice"
import type { UndoDirection } from "@/undo-list"

export type DeckFailure = "import-failed" | "export-failed" | "picture-uploading"

export function useDeckStatus() {
  const [paintedDeck, setPaintedDeck] = useState<string | undefined>(undefined)
  const [pending, setPending] = useState(false)
  const [offline, setOffline] = useState(() => navigator.onLine === false)
  const [failure, setFailure] = useState<DeckFailure | null>(null)
  const [refused, setRefused] = useState(false)

  const settle = useCallback((outcome: CommitOutcome) => {
    if (outcome === "sent") setPending(false)
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
    offline,
    failure,
    setFailure,
    refused,
    setRefused,
    settle,
    leftNetwork,
  }
}

export function shownNotice(shown: {
  readonly failure: DeckFailure | null
  readonly told: UndoDirection | null
  readonly picture: ThinNotice | null
  readonly offline: boolean
  readonly pending: boolean
}): ThinNotice | null {
  const { failure, told, offline, pending } = shown
  const toldNotice: ThinNotice | null = told === null ? null : told === "undo" ? "undo-changed" : "redo-changed"
  return failure ?? toldNotice ?? shown.picture ?? (offline && pending ? "offline" : null)
}
