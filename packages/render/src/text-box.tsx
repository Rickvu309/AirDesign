import { ElementHost, type ElementPaintProps } from "./element-host.js"

export function TextBoxArt(props: ElementPaintProps) {
  return <ElementHost {...props} drawnWhenBlank={false} fallbackName="Shape" unshown={false} />
}
