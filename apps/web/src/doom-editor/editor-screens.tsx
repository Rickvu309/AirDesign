import { editorRoutes } from "./editor-routes"
import { airaSamples, EditorSample, sampleText, saveSamples } from "./editor-sample"

export const screens = {
  [editorRoutes.agentWorking]: () => <EditorSample start={{ panel: "agent", aira: airaSamples.working }} />,
  [editorRoutes.agentComplete]: () => <EditorSample start={{ panel: "agent", aira: airaSamples.done }} />,
  [editorRoutes.agentLong]: () => <EditorSample start={{ panel: "agent", aira: airaSamples.long }} />,
  [editorRoutes.designPanel]: () => <EditorSample start={{ panel: "design", aira: airaSamples.done }} />,
  [editorRoutes.shapes]: () => <EditorSample start={{ panel: "agent", aira: airaSamples.done, shapes: "tray" }} />,
  [editorRoutes.shapesExpanded]: () => (
    <EditorSample start={{ panel: "agent", aira: airaSamples.done, shapes: "grid" }} />
  ),
  [editorRoutes.text]: () => <EditorSample start={{ panel: "agent", aira: airaSamples.done, tool: "text" }} />,
  [editorRoutes.textFormat]: () => (
    <EditorSample
      start={{ panel: "agent", aira: airaSamples.done, ...(sampleText === undefined ? {} : { editing: sampleText }) }}
    />
  ),
  [editorRoutes.runFailed]: () => <EditorSample start={{ panel: "agent", aira: airaSamples.failed }} />,
  [editorRoutes.offline]: () => (
    <EditorSample start={{ panel: "agent", aira: airaSamples.done, save: saveSamples.offline }} />
  ),
  [editorRoutes.setAside]: () => (
    <EditorSample start={{ panel: "agent", aira: airaSamples.done, save: saveSamples.setAside }} />
  ),
  [editorRoutes.unreached]: () => (
    <EditorSample start={{ panel: "agent", aira: airaSamples.done, save: saveSamples.unreached }} />
  ),
  [editorRoutes.setAsideTooLarge]: () => (
    <EditorSample start={{ panel: "agent", aira: airaSamples.done, save: saveSamples.setAsideTooLarge }} />
  ),
}
