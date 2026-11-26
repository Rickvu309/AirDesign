import { DoomCanvas, type CanvasCard, type CanvasProps } from "./canvas"

export function GridLiveCanvas(
  props: Omit<
    CanvasProps,
    "zoom" | "room" | "viewport" | "overlay" | "slideNumber" | "toolbarHost" | "notice" | "onZoom"
  > & {
    readonly card: CanvasCard
  },
) {
  return (
    <DoomCanvas
      {...props}
      zoom={1}
      room={{ w: 1, h: 1 }}
      viewport={null}
      overlay={0}
      slideNumber={0}
      toolbarHost={null}
      notice={null}
      onZoom={() => undefined}
    />
  )
}
