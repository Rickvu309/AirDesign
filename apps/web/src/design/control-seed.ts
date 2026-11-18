import type { Color, Desc } from "@airdesign/document"

const backdrop: Color = { scheme: "lt1" }
const downward = 5_400_000
const seen = { op: "alpha", val: 40_000 } as const
const startingIcon = "star"

export function caseSeed(key: string, color: Color): unknown {
  switch (key) {
    case "effects.shadow.outer":
    case "effects.innerShadow.inner":
      return { blur: 50_800, distance: 38_100, direction: 2_700_000, color: { rgb: "000000", transforms: [seen] } }
    case "effects.glow.halo":
      return { radius: 63_500, color: { ...color, transforms: [...(color.transforms ?? []), seen] } }
    case "effects.softEdge.radius":
    case "effects.blur.radius":
      return 63_500
    case "image.recolor.duotone":
      return { dark: color, light: backdrop }
    case "fills.paint.image":
      return startingIcon
    default:
      return undefined
  }
}

export function firstColor(value: unknown): Color | null {
  if (typeof value !== "object" || value === null) return null
  if ("scheme" in value || "rgb" in value || "system" in value || "preset" in value) return value as Color
  for (const item of Object.values(value)) {
    const found = firstColor(item)
    if (found !== null) return found
  }
  return null
}

export function seedOf(desc: Desc, color: Color, at = 0, count = 1, node: string | null = null): unknown {
  switch (desc.kind) {
    case "number":
      if (desc.unit === "fraction" && count > 1) return Math.round((at / (count - 1)) * desc.max)
      return desc.unit === "angle" ? downward : Math.max(desc.min, 0)
    case "flag":
      return false
    case "mark":
      return true
    case "color":
      return at % 2 === 0 ? color : backdrop
    case "choice":
      return desc.options[0]
    case "record":
      return Object.fromEntries(
        Object.entries(desc.fields).map(([name, field]) => [name, seedOf(field, color, at, count, node)]),
      )
    case "list": {
      const length = Math.max(desc.min, 2)
      return Array.from({ length }, (_, item) => seedOf(desc.item, color, item, length, node))
    }
    case "union": {
      const [name, item] = Object.entries(desc.cases).find(([, each]) => each.kind !== "mark") ?? []
      return name === undefined || item === undefined ? null : { [name]: seedOf(item, color, at, count, node) }
    }
    case "node":
      return node
    default:
      return null
  }
}
