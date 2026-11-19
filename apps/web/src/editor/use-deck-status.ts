import { watchUnsent } from "@airdesign/live"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { toast } from "@/components/ui/toast"
import type { CommitOutcome, SaveRefusal } from "@/commit-edit"
import { productCopy } from "@/copy/product-copy"
import { signInAddress, type ThinNotice } from "@/thin-notice"
import type { UndoDirection } from "@/undo-list"

export type DeckFailure = "import-failed" | "export-failed" | "picture-uploading"

export type SaveStatus = "saved" | "saving" | "offline" | "unreached" | "unsaved"

function watchNetwork(change: () => void): () => void {
  window.addEventListener("online", change)
  window.addEventListener("offline", change)
  return () => {
    window.removeEventListener("online", change)
    window.removeEventListener("offline", change)
  }
}

const browserOnline = () => navigator.onLine !== false

export function tellRefusal(outcome: CommitOutcome): void {
  if (outcome === "too-large") toast.error(productCopy.editTooLarge, { id: "edit-too-large" })
}

export function useDeckStatus(id: string) {
  const [paintedDeck, setPaintedDeck] = useState<string | undefined>(undefined)
  const [pending, setPending] = useState(false)
  useEffect(() => watchUnsent(id, setPending), [id])
  const online = useSyncExternalStore(watchNetwork, browserOnline)
  const [offline, setOffline] = useState(() => navigator.onLine === false)
  const [failure, setFailure] = useState<DeckFailure | null>(null)
  const [refused, setRefused] = useState(false)
  const [aside, setAside] = useState(0)
  const [asideTooLarge, setAsideTooLarge] = useState(false)
  const [refusal, setRefusal] = useState<SaveRefusal | null>(null)

  const settle = useCallback((outcome: CommitOutcome) => {
    if (outcome === "sent") {
      setAside(0)
      setAsideTooLarge(false)
    }
    if (outcome === "set-aside" || outcome === "set-aside-too-large") {
      setAside((count) => count + 1)
      setAsideTooLarge(outcome === "set-aside-too-large")
    }
    tellRefusal(outcome)
    if (outcome === "refused" || outcome === "too-large") return
    setOffline(outcome === "offline")
    setRefusal(outcome === "storage" || outcome === "size" ? outcome : null)
    if (outcome === "signed-out") window.location.assign(signInAddress(window.location))
  }, [])
  const leftNetwork = useCallback(() => setOffline(true), [])

  return {
    paintedDeck,
    setPaintedDeck,
    pending,
    online,
    offline,
    failure,
    setFailure,
    refused,
    setRefused,
    aside,
    asideTooLarge,
    refusal,
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
  readonly asideTooLarge: boolean
  readonly refusal: SaveRefusal | null
}): ThinNotice | null {
  const { failure, told, offline, pending } = shown
  const toldNotice: ThinNotice | null = told === null ? null : told === "undo" ? "undo-changed" : "redo-changed"
  const asideNotice: ThinNotice | null =
    shown.aside === 0 ? null : shown.asideTooLarge ? "set-aside-too-large" : "set-aside"
  const unsentNotice: ThinNotice | null = offline && pending ? (shown.online ? "unreached" : "offline") : null
  const refusedNotice: ThinNotice | null =
    pending && shown.refusal !== null ? (shown.refusal === "size" ? "too-large" : "storage-failed") : null
  return failure ?? toldNotice ?? shown.picture ?? asideNotice ?? unsentNotice ?? refusedNotice
}

export function saveStatus(shown: {
  readonly online: boolean
  readonly offline: boolean
  readonly pending: boolean
  readonly refusal: SaveRefusal | null
}): SaveStatus {
  if (!shown.online) return "offline"
  if (!shown.pending) return "saved"
  if (shown.offline) return "unreached"
  return shown.refusal === null ? "saving" : "unsaved"
}
