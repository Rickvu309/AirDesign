import type { ComponentType } from "react"
import { ChoiceControl } from "@/design/controls/choice"
import { ColorControl } from "@/design/controls/color"
import { LengthControl } from "@/design/controls/length"
import { TableControl } from "@/design/controls/table"
import { TextControl } from "@/design/controls/text"
import { ToggleControl } from "@/design/controls/toggle"
import type { ControlKind, ControlProps } from "@/design/panel"

export const controlViews: Partial<Readonly<Record<ControlKind, ComponentType<ControlProps>>>> = {
  length: LengthControl,
  toggle: ToggleControl,
  choice: ChoiceControl,
  color: ColorControl,
  text: TextControl,
  table: TableControl,
}
