import { ElementHost, type ElementPaintProps } from "./element-host.js"

export function TextBoxArt(props: ElementPaintProps) {
  return (
    <ElementHost
      {...props}
      drawnWhenBlank={false}
      fallbackName={props.element.editable ? "Text box" : "Shape"}
      unshown={false}
    />
  )
}
