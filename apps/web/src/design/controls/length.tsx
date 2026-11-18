import { designCopy } from "@/copy/design-copy"
import { NumberField } from "@/design/controls/number"
import type { ControlProps } from "@/design/panel"

export function LengthControl(props: ControlProps) {
  const unit = props.control.look.unit ?? (props.control.numberScale === undefined ? designCopy.points : "%")
  return <NumberField {...props} unit={unit} kind="length" />
}
