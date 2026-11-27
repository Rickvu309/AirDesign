import { isRefusal, parseTheme, sameValue, type Theme } from "@airdesign/doom"

import consulting from "../files/styles/consulting.json" with { type: "json" }
import editorial from "../files/styles/editorial.json" with { type: "json" }
import midnight from "../files/styles/midnight.json" with { type: "json" }
import neutral from "../files/styles/neutral.json" with { type: "json" }
import technical from "../files/styles/technical.json" with { type: "json" }

type PresetFile = {
  readonly id: string
  readonly name: string
  readonly powerPoint: { readonly map: string; readonly followedLink: string }
  readonly colors: unknown
  readonly fonts: unknown
  readonly textStyles?: unknown
  readonly effectStyles?: unknown
}

function readPreset({ id, name, powerPoint: _powerPoint, ...values }: PresetFile) {
  const theme = parseTheme({ textStyles: neutral.textStyles, effectStyles: neutral.effectStyles, ...values })
  if (isRefusal(theme)) throw new Error(`Invalid theme preset ${id}.json: ${JSON.stringify(theme)}`)
  return { id, name, theme } as const
}

const neutralPreset = readPreset(neutral)
export const newDeckTheme = neutralPreset.theme
export const themePresets: readonly ReturnType<typeof readPreset>[] = [
  ...[consulting, editorial, midnight].map(readPreset),
  neutralPreset,
  readPreset(technical),
]

export function themePresetById(id: unknown) {
  return themePresets.find((preset) => preset.id === id)
}

export function themePresetOf(theme: Theme) {
  return themePresets.find((preset) => sameValue(preset.theme, theme))
}
