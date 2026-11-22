import {
  type ColorVar,
  type Effect,
  type EffectStyleName,
  type Hex,
  type Px,
  colorVars,
  effectStyleNames,
  px,
  readEffectList,
  readHex,
} from "./paint.js"
import { type Reader, finite, integer, keyed, literal, object, words } from "./read-kit.js"
import { type TextStyleName, textStyleNames } from "./text.js"

export type TextStyle = {
  readonly size: Px
  readonly font: "heading" | "body"
  readonly weight: number
  readonly lineHeight: number
  readonly tracking: Px
  readonly case?: "upper"
}
export type Theme = {
  readonly colors: Readonly<Record<ColorVar, Hex>>
  readonly fonts: { readonly heading: string; readonly body: string }
  readonly textStyles: Readonly<Record<TextStyleName, TextStyle>>
  readonly effectStyles: Readonly<Record<EffectStyleName, readonly Effect[]>>
}

export type ThemeKey =
  | `theme.colors.${ColorVar}`
  | `theme.fonts.${"heading" | "body"}`
  | `theme.textStyles.${TextStyleName}`
  | `theme.effectStyles.${EffectStyleName}`

const readFontName = words(100, 1)
const readTextStyle: Reader<TextStyle> = object(
  {
    size: px(1, 2_000),
    font: literal(["heading", "body"]),
    weight: integer(100, 900),
    lineHeight: finite(0.5, 5),
    tracking: px(-100, 100),
  },
  { case: literal(["upper"]) },
)

export const readTheme: Reader<Theme> = object({
  colors: keyed(colorVars, readHex),
  fonts: object({ heading: readFontName, body: readFontName }),
  textStyles: keyed(textStyleNames, readTextStyle),
  effectStyles: keyed(effectStyleNames, readEffectList),
})

const entries = <const N extends string>(group: string, names: readonly N[]) =>
  names.map((name) => `theme.${group}.${name}` as ThemeKey)

export const themeKeys: readonly ThemeKey[] = [
  ...entries("colors", colorVars),
  ...entries("fonts", ["heading", "body"]),
  ...entries("textStyles", textStyleNames),
  ...entries("effectStyles", effectStyleNames),
]

export function readThemeKey(raw: unknown): ThemeKey | undefined {
  return themeKeys.find((key) => key === raw)
}

const keyReaders: Readonly<Record<keyof Theme, Reader<unknown>>> = {
  colors: readHex,
  fonts: readFontName,
  textStyles: readTextStyle,
  effectStyles: readEffectList,
}

const partsOf = (key: ThemeKey) => {
  const [, group = "", name = ""] = key.split(".")
  return { group: group as keyof Theme, name }
}

export const readThemeValue = (key: ThemeKey): Reader<unknown> => keyReaders[partsOf(key).group]

export function themeValueAt(theme: Theme, key: ThemeKey): unknown {
  const { group, name } = partsOf(key)
  return (theme[group] as Readonly<Record<string, unknown>>)[name]
}

export function withThemeValue(theme: Theme, key: ThemeKey, value: unknown): Theme {
  const { group, name } = partsOf(key)
  return { ...theme, [group]: { ...theme[group], [name]: value } }
}
