import { EditorToast } from "@/editor/agent-panel"
import { galleryDeck } from "@/editor/gallery-deck"
import { SlideGrid } from "@/editor/slide-grid"

export function GridDefault() {
  return <SlideGrid state="idle" title={galleryDeck.title} />
}

export function GridAddHover() {
  return <SlideGrid state="hover" title={galleryDeck.title} />
}

export function GridAddHold() {
  return <SlideGrid state="hold" title={galleryDeck.title} />
}

export function GridPasted() {
  return (
    <SlideGrid
      state="pasted"
      title={galleryDeck.title}
      toast={<EditorToast kind="success" text="2 slides pasted from PowerPoint" action="Undo" />}
    />
  )
}
