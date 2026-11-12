import { ElementHost, type ElementPaintProps } from "./element-host.js"

export function FrameArt(props: ElementPaintProps) {
  const chart = props.element.kind === "chart"
  return <ElementHost {...props} drawnWhenBlank={false} fallbackName={chart ? "Chart" : "Shape"} unshown={chart} />
}
