import type { KeyboardEvent as ReactKeyboardEvent } from "react"

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
