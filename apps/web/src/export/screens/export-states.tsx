import { EditorSample } from "@/doom-editor/editor-sample"
import { firstChoice } from "@/export/export-choice"
import { ExportDialog } from "@/export/export-dialog"
import { FailedToast } from "@/export/export-toast"

const sampleCount = 7

export function PowerpointOptions() {
  return (
    <EditorSample start={{ panel: "agent" }}>
      <ExportDialog choice={firstChoice(sampleCount)} count={sampleCount} />
    </EditorSample>
  )
}

export function PdfOptions() {
  return (
    <EditorSample start={{ panel: "agent" }}>
      <ExportDialog choice={{ ...firstChoice(sampleCount), format: "pdf" }} count={sampleCount} />
    </EditorSample>
  )
}

export function ExportFailedScreen() {
  return (
    <EditorSample start={{ panel: "agent" }}>
      <FailedToast />
    </EditorSample>
  )
}
