import * as doom from "@airdesign/doom"

export type ShownShape = { readonly preset: string; readonly adjust: Readonly<Record<string, number>> }

const isPreset = (name: string): boolean => doom.shapeNames.includes(name)

export function shownShape(geometry: doom.Geometry | undefined): ShownShape | null {
  if (geometry === undefined || geometry.kind === "rect") return { preset: "rect", adjust: {} }
  if (geometry.kind === "ellipse") return { preset: "ellipse", adjust: {} }
  if (geometry.kind !== "preset" || !isPreset(geometry.name)) return null
  const defaults = doom.adjustDefaults(geometry.name)
  const adjust = Object.fromEntries(
    Object.keys(defaults).map((name, at) => [name, geometry.adjust?.[at] ?? defaults[name] ?? 0]),
  )
  return { preset: geometry.name, adjust }
}

export function shapeWrite(value: unknown): doom.Geometry | undefined {
  if (typeof value !== "object" || value === null || !("preset" in value)) return undefined
  const { preset } = value
  if (typeof preset !== "string" || !isPreset(preset)) return undefined
  if (preset === "rect") return { kind: "rect" }
  if (preset === "ellipse") return { kind: "ellipse" }
  const held = "adjust" in value && typeof value.adjust === "object" && value.adjust !== null ? value.adjust : {}
  const typed = held as Readonly<Record<string, unknown>>
  const defaults = doom.adjustDefaults(preset)
  const names = Object.keys(defaults)
  if (!names.some((name) => typeof typed[name] === "number")) return { kind: "preset", name: preset }
  const adjust = names.map((name) => {
    const given = typed[name]
    return typeof given === "number" ? given : (defaults[name] ?? 0)
  })
  return { kind: "preset", name: preset, adjust }
}
