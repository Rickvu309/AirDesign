import type { KeyboardEvent as ReactKeyboardEvent } from "react"

const designPanel = "[data-design-panel]"
const pickerSlots = ["select-content", "popover-content", "dropdown-menu-content", "dropdown-menu-sub-content"]
const pickers = pickerSlots.map((slot) => `[data-slot="${slot}"]`).join(", ")
const openPickers = pickerSlots.map((slot) => `[data-slot="${slot}"][data-open]`).join(", ")

export function toolKeyPlace(target: EventTarget | null): "editor" | "slides" | null {
  if (!(target instanceof Element)) return null
  if (target.closest("[data-slide-paint], [data-layers-panel]") !== null) return "editor"
  return target.closest("[data-slide-list]") !== null ? "slides" : null
}

export function editorOwnsKey(event: KeyboardEvent | ReactKeyboardEvent): boolean {
  const overlays = [
    ...document.querySelectorAll<HTMLElement>('[role="menu"][data-open], [data-slot="popover-content"][data-open]'),
  ]
  const overlay = overlays.at(-1)
  if (overlay === undefined) return true
  const target = event.target
  if (target instanceof Node && overlays.some((popup) => popup.contains(target))) return false
  const native = "nativeEvent" in event ? event.nativeEvent : event
  event.preventDefault()
  event.stopPropagation()
  native.stopImmediatePropagation()
  if (event.key === "Escape" && !native.isComposing)
    overlay.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }),
    )
  return false
}

export function gridEscapeFromControl(event: ReactKeyboardEvent<HTMLDivElement>): boolean {
  const { target } = event
  return (
    event.key === "Escape" &&
    !event.defaultPrevented &&
    target instanceof Element &&
    event.currentTarget.contains(target) &&
    target.closest("button, a[href], [role=button]") !== null &&
    target.closest(
      "[data-grid-viewport], input, textarea, select, [contenteditable], [role=dialog], [role=alertdialog]",
    ) === null &&
    document.querySelector('[role="dialog"][data-open], [role="alertdialog"][data-open]') === null &&
    editorOwnsKey(event)
  )
}

export function pickerOpen(): boolean {
  return document.querySelector(openPickers) !== null
}

export function leavesPicker(event: FocusEvent): boolean {
  const { target, relatedTarget } = event
  return (
    target instanceof Element &&
    target.closest(pickers) !== null &&
    !(relatedTarget instanceof Element && relatedTarget.closest(pickers) !== null)
  )
}

export type Hand = "pointer" | "keys"

const heldOnly = new Set(["Shift", "Control", "Alt", "Meta", "Escape"])

export function handOf(event: KeyboardEvent | PointerEvent, was: Hand): Hand {
  if (!("key" in event)) return "pointer"
  return heldOnly.has(event.key) ? was : "keys"
}

export function pickerHandsKeysBack(target: EventTarget | null, leftBy: Hand | null): boolean {
  return (
    leftBy === "pointer" &&
    target instanceof Element &&
    target.matches("[aria-haspopup]") &&
    target.closest(designPanel) !== null
  )
}
