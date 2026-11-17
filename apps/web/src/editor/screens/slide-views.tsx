import { EditorToast } from "@/editor/agent-panel"
import { productCopy } from "@/copy/product-copy"
import { galleryDeck } from "@/editor/gallery-deck"
import { DesignElementArt } from "@/editor/design-element-art"
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

export function DesignElementScreen() {
  return <EditorView {...galleryDeck} run="done" panel="design" designed={<DesignElementArt />} />
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

export function TextFormatScreen() {
  return <EditorView {...galleryDeck} run="done" formats={{ bold: "on", italic: "off", underline: "mixed" }} />
}

export function TableScreen() {
  return <EditorView {...galleryDeck} run="done" activeTool="table" tablePicker />
}

export function RunFailed() {
  return <EditorView {...galleryDeck} run="failed" />
}

export function SetAside() {
  return (
    <EditorView
      {...galleryDeck}
      run="done"
      toast={<EditorToast still kind="error" text={productCopy.editsSetAside} place="canvas" />}
    />
  )
}

export function SetAsideTooLarge() {
  return (
    <EditorView
      {...galleryDeck}
      run="done"
      toast={<EditorToast kind="error" text={productCopy.editSetAsideTooLarge} place="canvas" />}
    />
  )
}

export function Offline() {
  return (
    <EditorView
      {...galleryDeck}
      run="offline"
      toast={<EditorToast still kind="info" text="You're offline. Edits are saved on this device." place="canvas" />}
    />
  )
}

export function Unreached() {
  return (
    <EditorView
      {...galleryDeck}
      run="offline"
      toast={<EditorToast still kind="info" text={productCopy.editorUnreached} place="canvas" />}
    />
  )
}
