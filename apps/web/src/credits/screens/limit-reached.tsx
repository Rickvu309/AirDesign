import { airaSamples, EditorSample } from "@/editor/editor-sample"

export function LimitReached() {
  return <EditorSample start={{ panel: "agent", aira: airaSamples.limit }} />
}
