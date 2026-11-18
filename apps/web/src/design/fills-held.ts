import { paintSlots, readFills, type ScopedElement, type SetChange, type ShownFills } from "@airdesign/document"
import type { PanelReads } from "./panel"

export type Held = { readonly value: unknown; readonly mixed: boolean; readonly inherited: boolean }

export const ownHeld = (value: unknown): Held => ({ value, mixed: false, inherited: false })

export function shownFills(shown: PanelReads): ShownFills | null {
  const bottom = shown.fields?.["fills.p0"]
  if (bottom === undefined || bottom.value === null) return null
  const slots = Object.fromEntries(
    paintSlots.flatMap((slot) => {
      const read = shown.fields?.[`fills.${slot}`]?.value
      return read === undefined || read === null ? [] : [[slot, read]]
    }),
  )
  const source = shown.fields?.["fills.source"]?.value
  return { ...slots, ...(typeof source === "string" ? { source } : {}) } as ShownFills
}

export function fillsHeld(shown: PanelReads): Held {
  const fills = shownFills(shown)
  if (fills === null) return ownHeld(undefined)
  return { value: readFills(fills).slidesMode, mixed: false, inherited: shown.fields?.["fills.p0"]?.own !== true }
}

function overlaySlot(shown: PanelReads): number | null {
  const slots = paintSlots.map((slot) => shown.fields?.[`fills.${slot}`]?.value)
  const image = slots.findIndex((value) => typeof value === "object" && value !== null && "image" in value)
  if (image < 0) return null
  const above = slots.findLastIndex(
    (value, at) =>
      at > image && typeof value === "object" && value !== null && !("none" in value) && !("hidden" in value),
  )
  return above < 0 ? paintSlots.length - 1 : above
}

export function overlayHeld(shown: PanelReads): Held {
  const at = overlaySlot(shown)
  const value = at === null ? undefined : shown.fields?.[`fills.${paintSlots[at] ?? "p3"}`]?.value
  return ownHeld(value ?? { none: true })
}

export function overlayChange(view: ScopedElement, shown: PanelReads): (value: unknown) => SetChange {
  const slot = paintSlots[overlaySlot(shown) ?? paintSlots.length - 1] ?? "p3"
  return (value) => ({ target: { node: view.node }, fills: { [slot]: value } }) as SetChange
}
