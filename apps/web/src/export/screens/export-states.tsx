import { EditorView } from "@/editor/screens/editor-view"
import { ExportDialog } from "@/export/export-dialog"
import { DownloadedToast, FailedToast } from "@/export/export-toast"

export function PowerpointOptions() {
  return <EditorView overlay={<ExportDialog format="powerpoint" />} />
}

export function PdfOptions() {
  return <EditorView overlay={<ExportDialog format="pdf" />} />
}

export function DownloadedToastScreen() {
  return <EditorView toast={<DownloadedToast />} />
}

export function ExportFailedScreen() {
  return <EditorView toast={<FailedToast />} />
}
