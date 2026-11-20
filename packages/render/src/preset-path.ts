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

export const drawnPresets: readonly string[] = Object.keys(presets)

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

const ellipseArea: PresetRule = {
  area: "il it ir ib",
  adjusts: [],
  guides: [
    "idx cos wd2 2700000",
    "idy sin hd2 2700000",
    "il +- hc 0 idx",
    "ir +- hc idx 0",
    "it +- vc 0 idy",
    "ib +- vc idy 0",
  ],
  paths: [],
}

export type TextArea = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

export function presetTextArea(
  name: string,
  width: number,
  height: number,
  adjusts: Readonly<Record<string, number>> = {},
): TextArea | null {
  const rule = name === "ellipse" ? ellipseArea : Object.hasOwn(presets, name) ? presets[name] : undefined
  const [left, top, right, bottom] = rule?.area?.split(" ") ?? []
  if (rule === undefined || left === undefined || top === undefined || right === undefined || bottom === undefined)
    return null
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  try {
    const value = presetGuides(rule, width, height, adjusts)
    const [leftMargin, rightMargin] = margins(value(left), value(right), width)
    const [topMargin, bottomMargin] = margins(value(top), value(bottom), height)
    return { left: leftMargin, top: topMargin, right: rightMargin, bottom: bottomMargin }
  } catch {
    return null
  }
}

function margins(from: number, to: number, length: number): readonly [number, number] {
  const start = Math.max(0, Math.min(from, length))
  const end = Math.max(0, Math.min(to, length))
  return [Math.min(start, end), length - Math.max(start, end)]
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
