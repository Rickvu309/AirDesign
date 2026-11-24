import { LinkControl } from "./controls/link"
import { TypographyControl } from "@/design/controls/typography"
import type { ComponentType } from "react"
import { CornersControl } from "@/design/controls/corners"
import { ActionControl } from "@/design/controls/action"
import { AdjustControl } from "@/design/controls/adjust"
import { AngleControl } from "@/design/controls/angle"
import { ChoiceControl } from "@/design/controls/choice"
import { ColorControl } from "@/design/controls/color"
import { CountControl } from "@/design/controls/count"
import { LengthControl } from "@/design/controls/length"
import { ListControl } from "@/design/controls/list"
import { PercentControl } from "@/design/controls/percent"
import { PresetControl } from "@/design/controls/preset"
import { RecordControl } from "@/design/controls/record"
import { TextControl } from "@/design/controls/text"
import { ToggleControl } from "@/design/controls/toggle"
import { UnionControl } from "@/design/controls/union"
import type { ControlKind, ControlProps } from "@/design/panel"

export const controlViews: Partial<Readonly<Record<ControlKind, ComponentType<ControlProps>>>> = {
  corners: CornersControl,
  link: LinkControl,
  typography: TypographyControl,
  length: LengthControl,
  angle: AngleControl,
  percent: PercentControl,
  count: CountControl,
  adjust: AdjustControl,
  toggle: ToggleControl,
  choice: ChoiceControl,
  action: ActionControl,
  color: ColorControl,
  record: RecordControl,
  union: UnionControl,
  list: ListControl,
  text: TextControl,
  preset: PresetControl,
}
