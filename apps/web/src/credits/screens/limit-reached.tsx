import { airaSamples, EditorSample } from "@/doom-editor/editor-sample"

export function LimitReached() {
  return <EditorSample start={{ panel: "agent", aira: airaSamples.limit }} />
}
