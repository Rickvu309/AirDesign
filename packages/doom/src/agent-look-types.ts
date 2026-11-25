import type { AgentChart } from "./agent-chart.js"
import type { AgentEnd } from "./agent-end.js"
import type { AgentInsert } from "./agent-insert.js"
import type { AgentItem } from "./agent-item.js"
import type { InnerLook } from "./agent-inner-shadow.js"
import type { SlideLook } from "./agent-slide-look.js"
import type { WeightName } from "./painted-face.js"
import type { Arrow } from "./geometry.js"
import type { ColorVar, EffectStyleName, Hex, Px, Sides } from "./paint.js"
import type { CropSides } from "./picture-crop.js"
import type { TextStyleName } from "./text.js"

export type AgentColor = ColorVar | `${ColorVar}${"+" | "-"}${number}` | Hex
export type AgentGradient = {
  readonly gradient: readonly AgentColor[]
  readonly angle?: number
  readonly radial?: boolean
}
export type AgentFill = AgentColor | "none" | { readonly image: string } | AgentGradient
export type AgentBox = { readonly x: Px; readonly y: Px; readonly w: Px; readonly h: Px }
export type AgentLook = {
  readonly d?: string
  readonly fillStroke?: boolean
  readonly fill?: AgentFill
  readonly stroke?: AgentColor | "none"
  readonly strokeWidth?: Px
  readonly color?: AgentColor
  readonly radius?: Px
  readonly effect?: EffectStyleName | "none"
  readonly effectOpacity?: number
  readonly link?: string | "none"
  readonly clip?: boolean
  readonly mask?: boolean
  readonly opacity?: number
  readonly text?: string
  readonly insert?: AgentInsert
  readonly textStyle?: TextStyleName
  readonly align?: "left" | "center" | "right" | "justify"
  readonly layout?: "row" | "column" | "none"
  readonly gap?: Px
  readonly padding?: Px | Sides
  readonly icon?: string
  readonly arrow?: boolean | Arrow
  readonly startArrow?: Arrow
  readonly from?: AgentEnd
  readonly to?: AgentEnd
  readonly route?: "straight" | "elbow" | "curve"
  readonly component?: string
  readonly data?: ReturnType<typeof import("./component/values.js").record>
  readonly variant?: ReturnType<typeof import("./component/spec.js").variantRecord>
  readonly tokens?: ReturnType<typeof import("./component/spec.js").tokenRecord>
  readonly chart?: AgentChart
  readonly rows?: readonly (readonly string[])[]
  readonly items?: readonly AgentItem[]
  readonly axes?: readonly [string, string]
  readonly box?: AgentBox
  readonly name?: string
  readonly hidden?: boolean
  readonly locked?: boolean
  readonly size?: Px
  readonly font?: string
  readonly weight?: WeightName
  readonly lineHeight?: number
  readonly letterSpacing?: Px
  readonly case?: "none" | "upper" | "lower" | "title"
  readonly underline?: boolean
  readonly strike?: boolean
  readonly dash?: "solid" | "dash" | "dot"
  readonly fit?: "fill" | "fit" | "crop" | "tile"
  readonly crop?: CropSides
  readonly shape?: string
  readonly rotation?: number
  readonly flip?: "none" | "h" | "v" | "hv"
  readonly notes?: string
} & SlideLook &
  InnerLook
