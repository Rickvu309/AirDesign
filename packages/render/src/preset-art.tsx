import { ElementHost, type ElementPaintProps } from "./element-host.js"

export function PresetArt(props: ElementPaintProps) {
  return (
    <ElementHost
      {...props}
      drawnWhenBlank={false}
      fallbackName={props.element.kind === "connector" ? "Line" : "Shape"}
      unshown={false}
    />
  )
}
