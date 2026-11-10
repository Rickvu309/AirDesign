import { galleryDeck } from "@/editor/gallery-deck"
import { EditorView } from "@/editor/screens/editor-view"
import { ExportDialog } from "@/export/export-dialog"
import { DownloadedToast, FailedToast } from "@/export/export-toast"

export function PowerpointOptions() {
  return <EditorView {...galleryDeck} overlay={<ExportDialog format="powerpoint" />} />
}

export function PdfOptions() {
  return <EditorView {...galleryDeck} overlay={<ExportDialog format="pdf" />} />
}

export function DownloadedToastScreen() {
  return <EditorView {...galleryDeck} toast={<DownloadedToast />} />
}

export function ExportFailedScreen() {
  return <EditorView {...galleryDeck} toast={<FailedToast />} />
}
