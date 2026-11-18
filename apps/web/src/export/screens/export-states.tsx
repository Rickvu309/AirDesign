import { galleryDeck } from "@/editor/gallery-deck"
import { EditorView } from "@/editor/screens/editor-view"
import { firstChoice } from "@/export/export-choice"
import { ExportDialog } from "@/export/export-dialog"
import { FailedToast } from "@/export/export-toast"

const galleryCount = 12

export function PowerpointOptions() {
  return (
    <EditorView {...galleryDeck} overlay={<ExportDialog choice={firstChoice(galleryCount)} count={galleryCount} />} />
  )
}

export function PdfOptions() {
  return (
    <EditorView
      {...galleryDeck}
      overlay={<ExportDialog choice={{ ...firstChoice(galleryCount), format: "pdf" }} count={galleryCount} />}
    />
  )
}

export function ExportFailedScreen() {
  return <EditorView {...galleryDeck} toast={<FailedToast />} />
}
