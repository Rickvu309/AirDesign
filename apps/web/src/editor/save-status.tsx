import { productCopy } from "@/copy/product-copy"
import type { SaveStatus } from "@/editor/use-deck-status"

const words: Record<SaveStatus, string> = {
  saved: productCopy.saved,
  saving: productCopy.saving,
  offline: productCopy.savedOffline,
  unreached: productCopy.savedUnreached,
  unsaved: productCopy.unsaved,
}

export function SaveStatusLine({ status }: { status: SaveStatus }) {
  return (
    <span role="status" data-save-status={status} className="sr-only">
      {words[status]}
    </span>
  )
}
