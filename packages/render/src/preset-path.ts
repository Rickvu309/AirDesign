import { presetBasic } from "./preset-basic.js"
import { presetArrows } from "./preset-arrows.js"
import { presetRounded } from "./preset-rounded.js"
import { presetCallouts } from "./preset-callouts.js"
import { presetSpecial } from "./preset-special.js"
import { presetConnectors } from "./preset-connectors.js"
import { presetGuides, presetPath, type PresetRule } from "./preset-rule.js"

const presets: Readonly<Record<string, PresetRule>> = {
  ...presetBasic,
  ...presetArrows,
  ...presetRounded,
  ...presetCallouts,
  ...presetSpecial,
  ...presetConnectors,
}

export function presetOutline(
  name: string,
  width: number,
  height: number,
  adjusts: Readonly<Record<string, number>> = {},
) {
  const rule = Object.hasOwn(presets, name) ? presets[name] : undefined
  if (rule === undefined || !Number.isFinite(width) || !Number.isFinite(height)) return null
  try {
    const value = presetGuides(rule, width, height, adjusts)
    return rule.paths.map((path) => ({
      d: presetPath(
        path.data,
        value,
        path.width === undefined ? 1 : width / path.width,
        path.height === undefined ? 1 : height / path.height,
      ),
      fill: path.fill,
      stroke: path.stroke,
      ...(path.shade === undefined ? {} : { shade: path.shade }),
    }))
  } catch {
    return null
  }
}

const nativeOpen = new Set(["line", "straightConnector1"])

export function openPreset(name: string): boolean {
  if (nativeOpen.has(name)) return true
  const rule = Object.hasOwn(presets, name) ? presets[name] : undefined
  if (rule === undefined) return false
  return rule.paths.some((path) => path.stroke && !path.data.trimEnd().endsWith("Z"))
}

export function adjustDefaults(name: string): Readonly<Record<string, number>> {
  const rule = Object.hasOwn(presets, name) ? presets[name] : undefined
  return Object.fromEntries(
    (rule?.adjusts ?? []).map((definition) => {
      const [adjust = "", , value = "0"] = definition.trim().split(/\s+/)
      return [adjust, Number(value)]
    }),
  )
}
