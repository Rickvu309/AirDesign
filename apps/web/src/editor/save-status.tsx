import { useEffect, useState } from "react"
import { productCopy } from "@/copy/product-copy"
import type { SaveStatus } from "@/editor/use-deck-status"

export const savingDelay = 500

const words: Record<SaveStatus, string> = {
  saved: productCopy.saved,
  saving: productCopy.saving,
  offline: productCopy.savedOffline,
  unreached: productCopy.savedUnreached,
  unsaved: productCopy.unsaved,
}

export function useShownSave(status: SaveStatus): SaveStatus {
  const [late, setLate] = useState(false)
  useEffect(() => {
    if (status !== "saving") return
    const timer = setTimeout(() => setLate(true), savingDelay)
    return () => {
      clearTimeout(timer)
      setLate(false)
    }
  }, [status])
  return status === "saving" && !late ? "saved" : status
}

export function SaveStatusLine({ status }: { status: SaveStatus }) {
  return (
    <span role="status" data-save-status={status} className="sr-only">
      {words[status]}
    </span>
  )
}
