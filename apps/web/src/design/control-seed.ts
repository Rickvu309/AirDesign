import type { Desc } from "./control-desc"
import * as doom from "@airdesign/doom"

const backdrop: doom.Color = { var: "background" }
const downward = 5_400_000

export function firstColor(value: unknown): doom.Color | null {
  const color = doom.readColor(value)
  if (color !== undefined) return color
  if (typeof value !== "object" || value === null) return null
  for (const item of Object.values(value)) {
    const found = firstColor(item)
    if (found !== null) return found
  }
  return null
}

export function seedOf(desc: Desc, color: doom.Color, at = 0, count = 1): unknown {
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
        Object.entries(desc.fields).map(([name, field]) => [name, seedOf(field, color, at, count)]),
      )
    case "list": {
      const length = Math.max(desc.min, 2)
      return Array.from({ length }, (_, item) => seedOf(desc.item, color, item, length))
    }
    case "union": {
      const [name, item] = Object.entries(desc.cases).find(([, each]) => each.kind !== "mark") ?? []
      return name === undefined || item === undefined ? null : { [name]: seedOf(item, color, at, count) }
    }
    default:
      return null
  }
}
