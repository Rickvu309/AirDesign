import { dashPresets, type FieldValue } from "@airdesign/document"
import { child, inside, whole, type Held } from "./markup-held.js"
import { paintAttribute } from "./paint-color.js"
import { withChild, type Slot } from "./slot-edit.js"

type Dash = FieldValue<"border", "dash">
type LineTag = "a:ln" | "a:lnL" | "a:lnR" | "a:lnT" | "a:lnB"

const dashTags = ["a:prstDash", "a:custDash"]

export function readDash(line: Held): Dash | null | undefined {
  const preset = child(line, "a:prstDash")
  if (preset !== undefined) {
    const val = paintAttribute(preset.element, "val") ?? "solid"
    return dashPresets.find((each) => each === val) ?? null
  }
  const custom = child(line, "a:custDash")
  if (custom === undefined) return undefined
  const steps = inside(custom).filter((each) => each.kind === "a:ds")
  if (steps.length === 0 || steps.length > 32) return null
  const pattern = []
  for (const step of steps) {
    const dash = whole(step, "d")
    const gap = whole(step, "sp")
    if (dash === undefined || gap === undefined || dash < 1 || gap < 0 || Math.max(dash, gap) > 2_147_483_647)
      return null
    pattern.push({ dash, gap })
  }
  return { custom: pattern }
}

export function writeDash(line: LineTag, value: Dash | null): Slot {
  if (value === null) return withChild(line, dashTags, null, null)
  if (typeof value === "string") return withChild(line, dashTags, "a:prstDash", `<a:prstDash val="${value}"/>`)
  const steps = value.custom.map(({ dash, gap }) => `<a:ds d="${dash}" sp="${gap}"/>`).join("")
  return withChild(line, dashTags, "a:custDash", `<a:custDash>${steps}</a:custDash>`)
}
