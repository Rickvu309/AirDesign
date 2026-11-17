import { createLucideIcon } from "lucide-react"
import { NumberField } from "./number"
import type { ControlProps } from "../panel"

const Corner = createLucideIcon("Corner", [["path", { d: "M4 20v-9a7 7 0 0 1 7-7h9", key: "corner" }]])

export function CornersControl(props: ControlProps) {
  return (
    <NumberField
      {...props}
      control={{ ...props.control, look: { ...props.control.look, name: { show: "icon", icon: Corner } } }}
      unit=""
      kind="corners"
      scale={9525}
    />
  )
}
