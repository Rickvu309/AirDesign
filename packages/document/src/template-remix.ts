import { mappedSlots, templateColors, type Color, type MappedSlot, type TemplateColor } from "./color.js"

const colorNames = new Set<string>(templateColors)
const mappedNames = new Set<string>(mappedSlots)

export function presentSlots(slots: Readonly<Record<string, string | undefined>>): readonly TemplateColor[] {
  return templateColors.filter((slot) => slots[slot] !== undefined)
}

export function cycledColor(
  color: Color | null | undefined,
  present: readonly TemplateColor[],
  map: Readonly<Partial<Record<MappedSlot, TemplateColor>>>,
): Color | null {
  if (color === null || color === undefined || !("scheme" in color) || present.length < 2) return null
  const named = color.scheme
  const resolved = colorNames.has(named)
    ? (named as TemplateColor)
    : mappedNames.has(named)
      ? map[named as MappedSlot]
      : undefined
  if (resolved === undefined) return null
  const at = present.indexOf(resolved)
  const next = at < 0 ? undefined : present[(at + 1) % present.length]
  if (next === undefined || next === resolved) return null
  return color.transforms === undefined ? { scheme: next } : { scheme: next, transforms: color.transforms }
}
