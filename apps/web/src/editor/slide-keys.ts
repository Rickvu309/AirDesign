export type SlideKey = "remove" | "clone" | "up" | "down"

export function slideKey(event: {
  readonly key: string
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
}): SlideKey | null {
  if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "d") {
      return "clone"
    }
    if (event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.key === "ArrowUp") return "up"
    if (event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.key === "ArrowDown") return "down"
    return null
  }
  if (event.key === "Delete" || event.key === "Backspace") return "remove"
  return null
}
