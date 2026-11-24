import { themeFiles } from "./library/theme-index.js"
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
import { type Reader, detailOf, finite, integer, keyed, literal, object, words } from "./read-kit.js"
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

const readEveryTextStyle = keyed(textStyleNames, readTextStyle)
const readEffectStyles = keyed(effectStyleNames, readEffectList)
const themeFields = {
  colors: keyed(colorVars, readHex),
  fonts: object({ heading: readFontName, body: readFontName }),
}
const themeStyleFields = {
  textStyles: readEveryTextStyle,
  effectStyles: readEffectStyles,
}

function readBuiltIn<T>(file: string, raw: unknown, read: Reader<T>): T {
  try {
    return read(raw)
  } catch (thrown) {
    const { field, fault, form, refused } = detailOf(thrown)
    const reason = `${field ?? "entry"} (${fault ?? refused})`
    throw new Error(`Built-in theme ${file}: ${reason}${form === undefined ? "" : `. Expected ${form}`}`, {
      cause: thrown,
    })
  }
}

const { "fallback.json": fallback, ...libraryFiles } = themeFiles
export const defaultTheme: Theme = readBuiltIn(
  "fallback.json",
  fallback,
  object({ ...themeFields, ...themeStyleFields }),
)

const readEntry = object(
  {
    id: words(100, 1),
    name: words(100, 1),
    powerPoint: object({ map: literal(["light", "dark"]), followedLink: readHex }),
    ...themeFields,
  },
  themeStyleFields,
)

export type LibraryTheme = { readonly id: string; readonly name: string; readonly theme: Theme }

function readLibrary(files: Readonly<Record<string, unknown>>) {
  const entries = new Map<string, LibraryTheme>()
  for (const [file, raw] of Object.entries(files)) {
    const { id, name, powerPoint: _powerPoint, ...art } = readBuiltIn(file, raw, readEntry)
    if (entries.has(id)) throw new Error(`Built-in theme ${file}: duplicate id "${id}"`)
    entries.set(id, { id, name, theme: { ...defaultTheme, ...art } })
  }
  const neutral = entries.get("neutral")
  if (neutral === undefined) throw new Error('Built-in theme library is missing id "neutral"')
  return { ...Object.fromEntries(entries), neutral }
}

export const themeLibrary: Readonly<Record<string, LibraryTheme> & { neutral: LibraryTheme }> =
  readLibrary(libraryFiles)

const readTextStyles: Reader<Theme["textStyles"]> = (raw) =>
  readEveryTextStyle(typeof raw === "object" && raw !== null ? { ...defaultTheme.textStyles, ...raw } : raw)

export const readTheme: Reader<Theme> = object({
  ...themeFields,
  ...themeStyleFields,
  textStyles: readTextStyles,
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
