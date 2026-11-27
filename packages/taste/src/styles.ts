import { isRefusal, parseTheme, sameValue, type Theme } from "@airdesign/doom"

import { filesDir, fs, nodePath } from "./package-files.js"

import consulting from "../files/styles/consulting.json" with { type: "json" }
import editorial from "../files/styles/editorial.json" with { type: "json" }
import midnight from "../files/styles/midnight.json" with { type: "json" }
import neutral from "../files/styles/neutral.json" with { type: "json" }
import technical from "../files/styles/technical.json" with { type: "json" }

type ThemePatch = {
  readonly colors?: Readonly<Record<string, string>>
  readonly textStyles?: Readonly<Record<string, object>>
}

export type StyleVariant = { readonly name: string; readonly theme: Theme }
export type Style = {
  readonly id: string
  readonly name: string
  readonly theme: Theme
  readonly variants: readonly StyleVariant[]
}

type StyleFile = {
  readonly id: string
  readonly name: string
  readonly powerPoint: { readonly map: string; readonly followedLink: string }
  readonly colors: unknown
  readonly fonts: unknown
  readonly textStyles: unknown
  readonly effectStyles: unknown
  readonly variants: Readonly<Record<string, ThemePatch>>
}

function parsed(raw: unknown, where: string): Theme {
  const theme = parseTheme(raw)
  if (isRefusal(theme)) throw new Error(`Invalid style ${where}: ${JSON.stringify(theme)}`)
  return theme
}

function patched(theme: Theme, { colors, textStyles = {}, ...rest }: ThemePatch, where: string): Theme {
  if (Object.keys(rest).length > 0)
    throw new Error(`Invalid style ${where}: a variant holds only colors and textStyles`)
  const base: Readonly<Record<string, object>> = theme.textStyles
  const changed = Object.entries(textStyles).map(([name, value]) => [name, { ...base[name], ...value }])
  return parsed(
    {
      ...theme,
      colors: { ...theme.colors, ...colors },
      textStyles: { ...theme.textStyles, ...Object.fromEntries(changed) },
    },
    where,
  )
}

function readStyle({ id, name, powerPoint: _powerPoint, variants, ...values }: StyleFile): Style {
  const theme = parsed(values, `${id}.json`)
  return {
    id,
    name,
    theme,
    variants: Object.entries(variants).map(([variant, patch]) => ({
      name: variant,
      theme: patched(theme, patch, `${id}.json variant ${variant}`),
    })),
  }
}

const neutralStyle = readStyle(neutral)
export const newDeckTheme = neutralStyle.theme
export const styles: readonly Style[] = [
  ...[consulting, editorial, midnight].map(readStyle),
  neutralStyle,
  readStyle(technical),
]

export function style(id: unknown): Style | undefined {
  return styles.find((each) => each.id === id)
}

export function styleOf(theme: Theme): { readonly style: Style; readonly variant?: string } | undefined {
  for (const each of styles) {
    if (sameValue(each.theme, theme)) return { style: each }
    const variant = each.variants.find((candidate) => sameValue(candidate.theme, theme))
    if (variant !== undefined) return { style: each, variant: variant.name }
  }
  return undefined
}

export type StyleText = {
  readonly summary: string
  readonly markdown: string
  readonly parameters: readonly { readonly name: string; readonly description: string }[]
}

const parameterPattern = /^- `([^`]+)`:\s*(.+)$/

function summaryOf(markdown: string): string {
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith("## ")) break
    if (trimmed === "" || trimmed.startsWith("#")) continue
    return trimmed
  }
  return ""
}

function parametersOf(markdown: string): StyleText["parameters"] {
  const parameters: { readonly name: string; readonly description: string }[] = []
  let inParameters = false
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (/^##\s+/.test(trimmed)) {
      inParameters = /^##\s+parameters\s*$/i.test(trimmed)
      continue
    }
    if (!inParameters) continue
    const matched = parameterPattern.exec(line)
    if (matched !== null) parameters.push({ name: matched[1]!, description: matched[2]!.trim() })
  }
  return parameters
}

export function styleText(id: string): StyleText | undefined {
  if (style(id) === undefined) return undefined
  const markdown = fs()
    .readFileSync(nodePath().join(filesDir(), "styles", `${id}.md`), "utf8")
    .trimEnd()
  return { summary: summaryOf(markdown), markdown, parameters: parametersOf(markdown) }
}
