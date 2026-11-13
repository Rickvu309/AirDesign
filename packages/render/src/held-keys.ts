import { lineBreak } from "./paragraph-edit.js"

export type HeldKeys = {
  readonly stop: () => void
  readonly take: () => string
}

const editable = 'input, textarea, select, [contenteditable="true"]'

function typedBy(event: KeyboardEvent): string | null {
  if (event.isComposing || event.ctrlKey || event.metaKey) return null
  if (event.key === "Enter") return "\n"
  return [...event.key].length === 1 ? event.key : null
}

function intoEditable(event: Event): boolean {
  return event.target instanceof Element && event.target.closest(editable) !== null
}

export function holdKeys(document: Document): HeldKeys {
  let held: string[] = []
  function hold(event: KeyboardEvent) {
    if (intoEditable(event)) return
    if (event.key === "Escape" || event.key === "Tab") {
      stop()
      return
    }
    const typed = typedBy(event)
    if (event.key === "Backspace" && held.length > 0) held = held.slice(0, -1)
    else if (typed !== null) held = [...held, typed]
    else return
    event.preventDefault()
    event.stopPropagation()
  }
  function release(event: KeyboardEvent) {
    if (intoEditable(event) || (typedBy(event) === null && event.key !== "Backspace")) return
    event.preventDefault()
    event.stopPropagation()
  }
  function paste(event: ClipboardEvent) {
    const pasted = event.clipboardData?.getData("text/plain") ?? ""
    if (intoEditable(event) || pasted === "") return
    held = [...held, ...pasted.split(lineBreak).join("\n")]
    event.preventDefault()
    event.stopPropagation()
  }
  function stop() {
    document.removeEventListener("keydown", hold, true)
    document.removeEventListener("keyup", release, true)
    document.removeEventListener("paste", paste, true)
    document.removeEventListener("pointerdown", stop, true)
  }
  document.addEventListener("keydown", hold, true)
  document.addEventListener("keyup", release, true)
  document.addEventListener("paste", paste, true)
  document.addEventListener("pointerdown", stop, true)
  return {
    stop,
    take() {
      stop()
      const typed = held.join("")
      held = []
      return typed
    },
  }
}

export function typeHeld(document: Document, typed: string): void {
  typed.split("\n").forEach((line, index) => {
    const into = document.activeElement
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
    if (index > 0 && into !== null && into.dispatchEvent(enter)) document.execCommand("insertParagraph")
    if (line !== "") document.execCommand("insertText", false, line)
  })
}
