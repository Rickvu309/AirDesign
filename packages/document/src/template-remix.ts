import { mappedSlots, themeSlots, type Color, type MappedSlot, type ThemeSlot } from "./color.js"

const themeNames = new Set<string>(themeSlots)
const mappedNames = new Set<string>(mappedSlots)

export function presentSlots(slots: Readonly<Record<string, string | undefined>>): readonly ThemeSlot[] {
  return themeSlots.filter((slot) => slots[slot] !== undefined)
}

export function cycledColor(
  color: Color | null | undefined,
  present: readonly ThemeSlot[],
  map: Readonly<Partial<Record<MappedSlot, ThemeSlot>>>,
): Color | null {
  if (color === null || color === undefined || !("scheme" in color) || present.length < 2) return null
  const named = color.scheme
  const resolved = themeNames.has(named)
    ? (named as ThemeSlot)
    : mappedNames.has(named)
      ? map[named as MappedSlot]
      : undefined
  if (resolved === undefined) return null
  const at = present.indexOf(resolved)
  const next = at < 0 ? undefined : present[(at + 1) % present.length]
  if (next === undefined || next === resolved) return null
  return color.transforms === undefined ? { scheme: next } : { scheme: next, transforms: color.transforms }
}
