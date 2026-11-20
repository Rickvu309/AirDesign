import type { PaintStore } from "@airdesign/render"
import type { DeckFailure } from "@/editor/use-deck-status"
import { exportDeck, ExportStopped, type ExportRequest, type ExportStop } from "@/export/export-deck"
import { PicturesUploading, type PictureStore } from "@/picture-tool"
import type { ThinNotice } from "@/thin-notice"
import type { RecordsInFlight } from "@/undo-list"

export type ExportingDeck = {
  readonly id: string
  readonly records: { readonly current: RecordsInFlight }
  readonly pictureTool: { readonly store: PictureStore }
  readonly paint: { readonly current: PaintStore }
  readonly setFailure: (failure: DeckFailure | null) => void
}

const stopped: Readonly<Record<ExportStop, DeckFailure>> = {
  file: "export-file-missing",
  edits: "export-edits-unread",
  write: "export-edit-unwritten",
}

export const exportNotices: readonly ThinNotice[] = [
  "export-failed",
  "export-file-missing",
  "export-edits-unread",
  "export-edit-unwritten",
  "picture-uploading",
  "too-large",
]

export function exportFailure(error: unknown): DeckFailure {
  if (error instanceof PicturesUploading) return "picture-uploading"
  if (error instanceof ExportStopped) return stopped[error.stop]
  return "export-failed"
}

export function useExport(deck: ExportingDeck) {
  const { id, records, pictureTool, paint, setFailure } = deck
  async function onExport(request?: ExportRequest) {
    try {
      await exportDeck(id, records.current.landed(), pictureTool.store, request, paint.current.fits())
      setFailure(null)
    } catch (error) {
      setFailure(exportFailure(error))
    }
  }

  function tryAgain(notice: ThinNotice) {
    if (notice === "import-failed") window.location.assign("/")
    if (notice === "newer" || notice === "storage-failed") window.location.reload()
    if (exportNotices.includes(notice)) void onExport()
  }

  return { onExport, tryAgain }
}
