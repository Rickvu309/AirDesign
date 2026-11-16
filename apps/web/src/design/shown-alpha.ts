import { traits, type Color, type Desc, type TraitName } from "@airdesign/document"

type Loose = Readonly<Record<string, unknown>>

const alphaOps: readonly string[] = ["alpha", "alphaMod", "alphaOff"]

export function alphaFieldOver(trait: TraitName, field: string): string | undefined {
  const fields = Object.entries(traits[trait].fields as Readonly<Record<string, { readonly desc: Desc }>>)
  return fields.find(([, kind]) => kind.desc.kind === "alpha" && kind.desc.over === field)?.[0]
}

function colorAt(color: unknown, alpha: number): unknown {
  if (typeof color !== "object" || color === null) return color
  const transforms = (color as Color).transforms ?? []
  if (transforms.some((transform) => alphaOps.includes(transform.op))) return color
  return { ...color, transforms: [...transforms, { op: "alpha", val: alpha }] }
}

export function atShownAlpha(value: unknown, alpha: number): unknown {
  if (typeof value !== "object" || value === null) return value
  const fill = value as Loose
  if ("solid" in fill) return { solid: colorAt(fill.solid, alpha) }
  if ("gradient" in fill) {
    const gradient = fill.gradient as Loose & { readonly stops: readonly Loose[] }
    const stops = gradient.stops.map((stop) => ({ ...stop, color: colorAt(stop.color, alpha) }))
    return { gradient: { ...gradient, stops } }
  }
  if ("pattern" in fill) {
    const pattern = fill.pattern as Loose
    return { pattern: { ...pattern, fg: colorAt(pattern.fg, alpha), bg: colorAt(pattern.bg, alpha) } }
  }
  return value
}
