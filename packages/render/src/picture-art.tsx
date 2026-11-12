import { ElementHost, type ElementPaintProps } from "./element-host.js"

export function PictureArt(props: ElementPaintProps) {
  return <ElementHost {...props} drawnWhenBlank fallbackName="Image" unshown={props.element.fill === null} />
}
