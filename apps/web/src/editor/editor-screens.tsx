import * as doom from "@airdesign/doom"
import { exportRoutes } from "@/export/export-routes"
import { editorRoutes } from "./editor-routes"
import { airaSamples, EditorSample, groupedSample, sampleText, saveSamples } from "./editor-sample"
import { gridLayout } from "./grid-lines"
import { fittedGridCards } from "./grid-viewport"

const gridRoom = { width: 1470, height: 923 - 96 - 76 }

function titleZoomed() {
  let next = 0
  const groups = groupedSample.groups.map((size) =>
    Array.from({ length: size }, () => doom.nodeId(`s:${String(next++)}`)),
  )
  const size = groupedSample.size
  return fittedGridCards(gridLayout(groups, { width: size.w, height: size.h }), [0], gridRoom) ?? undefined
}

const zoomed = titleZoomed()

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
  [editorRoutes.gridFit]: () => <EditorSample start={{ grid: {} }} />,
  [editorRoutes.gridPicked]: () => <EditorSample start={{ grid: { picked: [0, 2, 3] } }} />,
  [editorRoutes.gridZoomed]: () => <EditorSample start={{ grid: zoomed === undefined ? {} : { camera: zoomed } }} />,
  [exportRoutes.pdf]: () => <EditorSample start={{ panel: "agent", export: "choosing" }} />,
  [exportRoutes.failed]: () => <EditorSample start={{ panel: "agent", export: "failed" }} />,
}
