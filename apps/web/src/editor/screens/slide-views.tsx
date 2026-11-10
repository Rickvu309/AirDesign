import { EditorToast } from "@/editor/agent-panel"
import { galleryDeck } from "@/editor/gallery-deck"
import { EditorView } from "@/editor/screens/editor-view"

export function AgentWorking() {
  return <EditorView {...galleryDeck} run="working" />
}

export function AgentComplete() {
  return <EditorView {...galleryDeck} run="done" toolMenu usageOpen />
}

export function AgentOwn() {
  return <EditorView {...galleryDeck} run="own" />
}

export function AgentLong() {
  return <EditorView {...galleryDeck} run="compose" />
}

export function TemplatePickerScreen() {
  return <EditorView {...galleryDeck} run="done" templatePicker />
}

export function DesignPanelScreen() {
  return <EditorView {...galleryDeck} run="done" panel="design" />
}

export function ImagesScreen() {
  return <EditorView {...galleryDeck} run="done" rail="images" activeTool="image" />
}

export function ShapesScreen() {
  return <EditorView {...galleryDeck} run="done" activeTool="shape" shapeTray />
}

export function ShapesExpandedScreen() {
  return <EditorView {...galleryDeck} run="done" rail="shapes" activeTool="shape" />
}

export function TextScreen() {
  return <EditorView {...galleryDeck} run="done" rail="text" activeTool="text" />
}

export function ActionsScreen() {
  return <EditorView {...galleryDeck} run="done" activeTool="actions" actionsMenu />
}

export function RunFailed() {
  return <EditorView {...galleryDeck} run="failed" />
}

export function Offline() {
  return (
    <EditorView
      {...galleryDeck}
      run="offline"
      toast={<EditorToast kind="info" text="You're offline. Edits are saved on this device." place="canvas" />}
    />
  )
}
