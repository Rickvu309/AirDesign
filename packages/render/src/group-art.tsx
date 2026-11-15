import { ElementHost, type ElementPaintProps } from "./element-host.js"

export function GroupArt(props: ElementPaintProps) {
  return <ElementHost {...props} drawnWhenBlank={false} fallbackName="Group" unshown={false} />
}
