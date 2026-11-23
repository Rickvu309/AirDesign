import { paintSlots } from "@airdesign/document"
import { shownFill, shownSlots } from "@airdesign/pptx"
import type { ShownField } from "@/design/panel"

type Parts = ReadonlyMap<string, Uint8Array>
type At = { readonly slide: string; readonly part: string; readonly shape: string }

function slotsOf(parts: Parts, at: At): readonly unknown[] {
  try {
    return shownSlots(parts, at)
  } catch {
    return []
  }
}

export function fillSlotFields(parts: Parts, at: At): Readonly<Record<string, ShownField>> {
  const shown = slotsOf(parts, at) as ReturnType<typeof shownSlots>
  if (shown.length === 0) return {}
  const fill = shownFill(parts, at)
  const slots = paintSlots.map((slot, index) => {
    const value = shown[index] ?? null
    const own = index > 0 || (value !== null && "image" in value) || fill?.own === true
    return [`fills.${slot}`, { value, own }] as const
  })
  const painted = slots.some(([, slot]) => slot.value !== null && !("none" in slot.value))
  return fill === null && !painted ? {} : Object.fromEntries(slots)
}
