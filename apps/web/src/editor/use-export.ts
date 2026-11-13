import { useState } from "react"
import type { DeckFailure } from "@/editor/use-deck-status"
import { exportDeck, type ExportRequest } from "@/export/export-deck"
import { PicturesUploading, type PictureStore } from "@/picture-tool"
import type { ThinNotice } from "@/thin-notice"

export type ExportingDeck = {
  readonly id: string
  readonly notesBar: { readonly queue: { readonly current: Promise<void> } }
  readonly pictureTool: { readonly store: PictureStore }
  readonly setFailure: (failure: DeckFailure | null) => void
}

export function useExport(deck: ExportingDeck) {
  const { id, notesBar, pictureTool, setFailure } = deck
  const [downloaded, setDownloaded] = useState<string | null>(null)

  async function onExport(request?: ExportRequest) {
    try {
      setDownloaded(await exportDeck(id, notesBar.queue.current, pictureTool.store, request))
      setFailure(null)
    } catch (error) {
      setFailure(error instanceof PicturesUploading ? "picture-uploading" : "export-failed")
    }
  }

  function tryAgain(notice: ThinNotice) {
    if (notice === "import-failed") window.location.assign("/")
    if (notice === "export-failed" || notice === "picture-uploading") void onExport()
  }

  return { downloaded, setDownloaded, onExport, tryAgain }
}
