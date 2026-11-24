import { adjustDefaults, presetSites } from "@airdesign/doom"
import type { Preset } from "./trait-geometry.js"

function sitesOf(preset: Preset, width: number, height: number, adjust: Readonly<Record<string, number>>) {
  if (preset === "line")
    return [
      { x: 0, y: 0 },
      { x: width, y: height },
    ]
  if (preset === "rect" || preset === "ellipse") return presetSites({ kind: preset }, width, height)
  const named = Object.entries(adjustDefaults(preset)).map(([name, value]) => adjust[name] ?? value)
  return presetSites({ kind: "preset", name: preset, adjust: named }, width, height)
}

export function siteSpot(
  preset: Preset,
  width: number,
  height: number,
  adjust: Readonly<Record<string, number>>,
  site: number,
) {
  return sitesOf(preset, width, height, adjust)[site] ?? null
}
