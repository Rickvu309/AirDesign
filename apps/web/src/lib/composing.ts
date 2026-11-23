import type { KeyboardEvent as ReactKeyboardEvent } from "react"

const safariComposingKeyCode = 229

export function composing(event: KeyboardEvent | ReactKeyboardEvent): boolean {
  const native = "nativeEvent" in event ? event.nativeEvent : event
  return native.isComposing || native.keyCode === safariComposingKeyCode
}
