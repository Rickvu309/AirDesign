import { EditorFrame } from "@/editor/editor-frame"
import { EditorShell, type EditorShellProps } from "@/editor/editor-shell"

export function EditorView(props: EditorShellProps) {
  return (
    <EditorFrame>
      <EditorShell {...props} />
    </EditorFrame>
  )
}
