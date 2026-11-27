import { isRefusal, parseTheme, sameValue, type Theme } from "@airdesign/doom"

import { filesDir, fs, nodePath } from "./package-files.js"

import consulting from "../files/styles/consulting.json" with { type: "json" }
import editorial from "../files/styles/editorial.json" with { type: "json" }
import midnight from "../files/styles/midnight.json" with { type: "json" }
import neutral from "../files/styles/neutral.json" with { type: "json" }
import technical from "../files/styles/technical.json" with { type: "json" }

export type Style = { readonly id: string; readonly name: string; readonly theme: Theme }

type StyleFile = {
  readonly id: string
  readonly name: string
  readonly powerPoint: { readonly map: string; readonly followedLink: string }
  readonly colors: unknown
  readonly fonts: unknown
  readonly textStyles?: unknown
  readonly effectStyles?: unknown
}

function readStyle({ id, name, powerPoint: _powerPoint, ...values }: StyleFile): Style {
  const theme = parseTheme({ textStyles: neutral.textStyles, effectStyles: neutral.effectStyles, ...values })
  if (isRefusal(theme)) throw new Error(`Invalid style ${id}.json: ${JSON.stringify(theme)}`)
  return { id, name, theme }
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

export function styleOf(theme: Theme): Style | undefined {
  return styles.find((each) => sameValue(each.theme, theme))
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
    const matched = parameterPattern.exec(trimmed)
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
