import { adjustLimit, presetAdjusts, presets, type FieldValue } from "@airdesign/document"
import { child, inside, type Held } from "./markup-held.js"
import { paintAttribute } from "./paint-color.js"

const guide = /^val [+-]?\d+$/

export function geometryOf(held: Held): FieldValue<"geometry", "shape"> | null {
  if (held.element.kind !== "a:prstGeom") return null
  const preset = presets.find((each) => each === paintAttribute(held.element, "prst"))
  if (preset === undefined) return null
  const named: readonly string[] = presetAdjusts[preset]
  const list = child(held, "a:avLst")
  const adjust: Record<string, number> = {}
  for (const element of list === undefined ? [] : inside(list)) {
    const name = paintAttribute(element, "name")
    const formula = paintAttribute(element, "fmla")
    if (element.kind !== "a:gd" || name === null || formula === null || !guide.test(formula)) return null
    const value = Number(formula.slice(4))
    if (!named.includes(name) || !Number.isSafeInteger(value) || Object.hasOwn(adjust, name)) return null
    adjust[name] = value
  }
  return Object.keys(adjust).length > adjustLimit ? null : { preset, adjust }
}
