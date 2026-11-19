import { LinkControl } from "./controls/link"
import { TypographyControl } from "@/design/controls/typography"
import { createElement, type ComponentType } from "react"
import { CornersControl } from "@/design/controls/corners"
import { ActionControl } from "@/design/controls/action"
import { AdjustControl } from "@/design/controls/adjust"
import { AngleControl } from "@/design/controls/angle"
import { AssetControl } from "@/design/controls/asset"
import { ChoiceControl } from "@/design/controls/choice"
import { DashControl } from "@/design/controls/dash"
import { ColorControl } from "@/design/controls/color"
import { CountControl } from "@/design/controls/count"
import { HexControl } from "@/design/controls/hex"
import { LengthControl } from "@/design/controls/length"
import { ListControl } from "@/design/controls/list"
import { NodeControl } from "@/design/controls/node"
import { PercentControl } from "@/design/controls/percent"
import { PresetControl } from "@/design/controls/preset"
import { RecordControl } from "@/design/controls/record"
import { TextControl } from "@/design/controls/text"
import { ToggleControl } from "@/design/controls/toggle"
import { UnionControl } from "@/design/controls/union"
import { SiteControl } from "@/design/controls/site"
import type { ControlKind, ControlProps } from "@/design/panel"

function ChoiceField(props: ControlProps) {
  return props.control.trait === "border" && props.control.field === "dash"
    ? createElement(DashControl, props)
    : createElement(ChoiceControl, props)
}

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
  choice: ChoiceField,
  action: ActionControl,
  color: ColorControl,
  hex: HexControl,
  record: RecordControl,
  union: UnionControl,
  list: ListControl,
  text: TextControl,
  asset: AssetControl,
  node: NodeControl,
  site: SiteControl,
  preset: PresetControl,
}
