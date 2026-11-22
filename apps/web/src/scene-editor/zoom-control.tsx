import { Button } from "@/components/ui/button"
import { sceneEditorCopy } from "@/copy/scene-editor-copy"
import { percentOf, type Zoom } from "./canvas-view"

export function ZoomControl(props: {
  readonly scale: number
  readonly fitted: boolean
  readonly onZoom: (zoom: Zoom) => void
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="absolute bottom-4 right-4"
      aria-label={sceneEditorCopy.zoomFit}
      data-zoom-percent=""
      onClick={() => props.onZoom(props.fitted ? 1 : "fit")}
    >
      {sceneEditorCopy.percent(percentOf(props.scale))}
    </Button>
  )
}
