import { CircleAlert } from "lucide-react"
import { useEffect, useState } from "react"
import { productCopy } from "@/copy/product-copy"
import type { SaveStatus } from "@/editor/use-deck-status"
import { cn } from "@/lib/class-names"

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

export function SaveStatusLine({ status, className }: { status: SaveStatus; className?: string }) {
  return (
    <span
      role="status"
      data-save-status={status}
      className={cn(
        "flex items-center gap-1 truncate text-[length:var(--type-caption)] leading-4",
        status === "unsaved" ? "text-danger-text" : "text-quiet",
        className,
      )}
    >
      {status === "unsaved" ? <CircleAlert aria-hidden="true" className="size-3 shrink-0" /> : null}
      {words[status]}
    </span>
  )
}
