import {
  type Reader,
  boolean,
  finite,
  integer,
  list,
  literal,
  matching,
  object,
  oneOf,
  variant,
  words,
} from "./read-kit.js"

export const colorVars = [
  "text",
  "background",
  "text2",
  "background2",
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
  "accent6",
  "link",
] as const
export type ColorVar = (typeof colorVars)[number]
export type Hex = `#${string}`
export type Px = number
export type Sides = { readonly t: Px; readonly r: Px; readonly b: Px; readonly l: Px }
export type Color = Hex | { readonly var: ColorVar; readonly tint?: number }

export type ImagePaint = {
  readonly kind: "image"
  readonly asset: string
  readonly fit: "fill" | "fit" | "crop" | "tile"
  readonly crop?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  readonly filters?: { readonly exposure?: number; readonly contrast?: number; readonly saturation?: number }
}
export type Paint = (
  | { readonly kind: "solid"; readonly color: Color }
  | {
      readonly kind: "gradient"
      readonly shape: "linear" | "radial"
      readonly angle: number
      readonly stops: readonly { readonly at: number; readonly color: Color }[]
    }
  | ImagePaint
) & { readonly opacity?: number; readonly visible?: boolean }

export type StrokeStyle = {
  readonly weight: Px
  readonly align: "inside" | "center" | "outside"
  readonly dash: "solid" | "dash" | "dot"
  readonly sides?: Partial<Sides>
}

export const effectStyleNames = ["soft", "lifted", "glow"] as const
export type EffectStyleName = (typeof effectStyleNames)[number]
export type Effect =
  | {
      readonly kind: "dropShadow" | "innerShadow"
      readonly color: Color
      readonly opacity?: number
      readonly x: Px
      readonly y: Px
      readonly blur: Px
      readonly spread: Px
    }
  | { readonly kind: "layerBlur" | "backgroundBlur"; readonly radius: Px }

export const px = (min = -1_000_000, max = 1_000_000) => finite(min, max)
export const size = px(0)

export const readHex: Reader<Hex> = (raw) => matching(/^#[0-9a-fA-F]{6}$/, 7)(raw).toLowerCase() as Hex

export const readColor: Reader<Color> = oneOf<Color>(
  readHex,
  object({ var: literal(colorVars) }, { tint: finite(-1, 1) }),
)

export const readSides = object({ t: size, r: size, b: size, l: size })

const fraction = finite(0, 1)
const filter = finite(-1, 1)
const onPaint = { opacity: fraction, visible: boolean }

export const readPaint: Reader<Paint> = variant("kind", {
  solid: object({ color: readColor }, onPaint),
  gradient: object(
    {
      shape: literal(["linear", "radial"]),
      angle: finite(-3600, 3600),
      stops: list(object({ at: fraction, color: readColor }), 16, 2),
    },
    onPaint,
  ),
  image: object(
    { asset: words(128, 1), fit: literal(["fill", "fit", "crop", "tile"]) },
    {
      ...onPaint,
      crop: object({ x: fraction, y: fraction, w: fraction, h: fraction }),
      filters: object({}, { exposure: filter, contrast: filter, saturation: filter }),
    },
  ),
})

export const readStrokeStyle: Reader<StrokeStyle> = object(
  { weight: size, align: literal(["inside", "center", "outside"]), dash: literal(["solid", "dash", "dot"]) },
  { sides: object({}, { t: size, r: size, b: size, l: size }) },
)

const shadow = object({ color: readColor, x: px(), y: px(), blur: size, spread: px() }, { opacity: fraction })
const blur = object({ radius: size })

export const readEffect: Reader<Effect> = variant("kind", {
  dropShadow: shadow,
  innerShadow: shadow,
  layerBlur: blur,
  backgroundBlur: blur,
})

export const readEffectList = list(readEffect, 8)
export const readCount = integer(0, 1_000_000)
