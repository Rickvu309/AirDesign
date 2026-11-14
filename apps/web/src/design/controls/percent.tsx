import { designCopy } from "@/copy/design-copy"
import { NumberField } from "@/design/controls/number"
import type { ControlProps } from "@/design/panel"

export function PercentControl(props: ControlProps) {
  return <NumberField {...props} unit={designCopy.percent} kind="percent" />
}
