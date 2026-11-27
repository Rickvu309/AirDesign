import type { IntentEnd } from "./intent-end.js"
import type { IntentInsert } from "./intent-insert.js"
import type { InnerLook } from "./intent-inner-shadow.js"
import type { SlideLook } from "./intent-slide-look.js"
import type { WeightName } from "./painted-face.js"
import type { Arrow } from "./geometry.js"
import type { ColorVar, EffectStyleName, Hex, Px, Sides } from "./paint.js"
import type { CropSides } from "./picture-crop.js"
import type { TextStyleName } from "./text.js"

export type IntentColor = ColorVar | `${ColorVar}${"+" | "-"}${number}` | Hex
export type IntentGradient = {
  readonly gradient: readonly IntentColor[]
  readonly angle?: number
  readonly radial?: boolean
}
export type IntentFill = IntentColor | "none" | { readonly image: string } | IntentGradient
export type IntentBox = { readonly x: Px; readonly y: Px; readonly w: Px; readonly h: Px }
export type IntentLook = {
  readonly d?: string
  readonly fillStroke?: boolean
  readonly fill?: IntentFill
  readonly stroke?: IntentColor | "none"
  readonly strokeWidth?: Px
  readonly color?: IntentColor
  readonly radius?: Px
  readonly effect?: EffectStyleName | "none"
  readonly effectOpacity?: number
  readonly link?: string | "none"
  readonly clip?: boolean
  readonly mask?: boolean
  readonly opacity?: number
  readonly text?: string
  readonly insert?: IntentInsert
  readonly language?: string
  readonly textStyle?: TextStyleName
  readonly align?: "left" | "center" | "right" | "justify"
  readonly layout?: "row" | "column" | "none"
  readonly gap?: Px
  readonly padding?: Px | Sides
  readonly icon?: string
  readonly arrow?: boolean | Arrow
  readonly startArrow?: Arrow
  readonly from?: IntentEnd
  readonly to?: IntentEnd
  readonly route?: "straight" | "elbow" | "curve"
  readonly lane?: Px
  readonly rows?: readonly (readonly string[])[]
  readonly box?: Partial<IntentBox>
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
