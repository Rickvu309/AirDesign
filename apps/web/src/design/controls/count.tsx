import { NumberField } from "@/design/controls/number"
import type { ControlProps } from "@/design/panel"

export function CountControl(props: ControlProps) {
  return <NumberField {...props} unit="" kind="count" />
}
