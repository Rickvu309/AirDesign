import { elementFrame, textLayer } from "./element-host.js"
import type { CanvasElement } from "./record.js"
import { ShapeArt } from "./shape-art.js"
import { SheetText } from "./sheet-text.js"
import { textLook, type Scaled } from "./text-look.js"

function DiagramShape(props: { readonly shape: CanvasElement; readonly scaled: Scaled }) {
  const { shape, scaled } = props
  return (
    <div data-diagram-shape={shape.key} style={elementFrame(shape, scaled, false, false)}>
      <ShapeArt element={shape} scaled={scaled} />
      {shape.text === null ? null : (
        <div style={textLayer(shape, shape.text, scaled)}>
          <SheetText look={textLook(shape.text, scaled)} text={shape.text} />
        </div>
      )}
    </div>
  )
}

export function DiagramArt(props: { readonly element: CanvasElement; readonly scaled: Scaled }) {
  const { element, scaled } = props
  if (element.diagram === undefined) return null
  return element.diagram.map((shape) => <DiagramShape key={shape.key} scaled={scaled} shape={shape} />)
}
