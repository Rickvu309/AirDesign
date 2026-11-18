import { designCopy } from "@/copy/design-copy"
import { NumberField } from "@/design/controls/number"
import type { ControlProps } from "@/design/panel"

export function LengthControl(props: ControlProps) {
  return (
    <NumberField {...props} unit={props.control.numberScale === undefined ? designCopy.points : "%"} kind="length" />
  )
}
