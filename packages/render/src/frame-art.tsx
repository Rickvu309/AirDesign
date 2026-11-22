import { ElementHost, type ElementPaintProps } from "./element-host.js"

export function FrameArt(props: ElementPaintProps) {
  const fallbackName = props.element.diagram !== undefined ? "Diagram" : "Shape"
  return <ElementHost {...props} drawnWhenBlank={false} fallbackName={fallbackName} unshown={false} />
}
