import { ElementHost, type ElementPaintProps } from "./element-host.js"

export function FrameArt(props: ElementPaintProps) {
  const chart = props.element.kind === "chart"
  const diagram = props.element.diagram !== undefined
  const painted = diagram || props.element.chart !== undefined
  const fallbackName = diagram ? "Diagram" : chart ? "Chart" : "Shape"
  return <ElementHost {...props} drawnWhenBlank={chart} fallbackName={fallbackName} unshown={chart && !painted} />
}
