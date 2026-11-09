import { EditorToast } from "@/editor/agent-panel"
import { SlideGrid } from "@/editor/slide-grid"

export function GridDefault() {
  return <SlideGrid state="idle" />
}

export function GridAddHover() {
  return <SlideGrid state="hover" />
}

export function GridAddHold() {
  return <SlideGrid state="hold" />
}

export function GridPasted() {
  return (
    <SlideGrid
      state="pasted"
      toast={<EditorToast kind="success" text="2 slides pasted from PowerPoint" action="Undo" />}
    />
  )
}
