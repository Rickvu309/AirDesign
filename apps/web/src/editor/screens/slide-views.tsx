import { EditorToast } from "@/editor/agent-panel"
import { EditorView } from "@/editor/screens/editor-view"

export function AgentWorking() {
  return <EditorView run="working" />
}

export function AgentComplete() {
  return <EditorView run="done" toolMenu usageOpen />
}

export function AgentOwn() {
  return <EditorView run="own" />
}

export function AgentLong() {
  return <EditorView run="compose" />
}

export function TemplatePickerScreen() {
  return <EditorView run="done" templatePicker />
}

export function DesignPanelScreen() {
  return <EditorView run="done" panel="design" />
}

export function ImagesScreen() {
  return <EditorView run="done" rail="images" activeTool="image" />
}

export function ShapesScreen() {
  return <EditorView run="done" activeTool="shape" shapeTray />
}

export function ShapesExpandedScreen() {
  return <EditorView run="done" rail="shapes" activeTool="shape" />
}

export function TextScreen() {
  return <EditorView run="done" rail="text" activeTool="text" />
}

export function ActionsScreen() {
  return <EditorView run="done" activeTool="actions" actionsMenu />
}

export function RunFailed() {
  return <EditorView run="failed" />
}

export function Offline() {
  return <EditorView run="offline" toast={<EditorToast kind="info" text="You're offline. Edits are saved on this device." place="canvas" />} />
}
