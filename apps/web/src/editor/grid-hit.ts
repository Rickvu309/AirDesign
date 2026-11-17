type GridBox = Pick<DOMRectReadOnly, "left" | "top" | "right" | "bottom">

export type GridHit = "number" | "blank" | "element" | "text" | "typing"

export type GridPressed = "slide" | "element" | "editor"

export function gridHit(frames: readonly { key: string; box: GridBox }[], x: number, y: number): string | null {
  return frames.findLast(({ box }) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)?.key ?? null
}

export function gridPress(hit: GridHit, active: boolean, modified: boolean, small = false): GridPressed {
  if (small || hit === "number" || hit === "blank") return "slide"
  if (!active) return "element"
  return hit === "text" && !modified ? "element" : "editor"
}

export function cardPress(event: {
  readonly target: EventTarget | null
  readonly clientX: number
  readonly clientY: number
  readonly shiftKey: boolean
  readonly metaKey: boolean
  readonly ctrlKey: boolean
}): GridPressed | null {
  const target = event.target
  if (!(target instanceof Element)) return null
  const card = target.closest("[data-grid-card]")
  if (card === null) return null
  const active = target.closest("[data-grid-edit]") !== null
  const hit =
    target.closest("[data-slide-number]") !== null
      ? "number"
      : active
        ? liveHit(target)
        : target.closest("[data-slide-entry]") === null
          ? null
          : thumbElementAt(card, event.clientX, event.clientY) === null
            ? "blank"
            : "element"
  return hit === null
    ? null
    : gridPress(hit, active, event.shiftKey || event.metaKey || event.ctrlKey, card.hasAttribute("data-grid-small"))
}

export function thumbElementAt(card: Element, x: number, y: number): string | null {
  const frames = [...card.querySelectorAll<HTMLElement>("[data-thumb-node]")]
  return gridHit(
    frames.flatMap((frame) => {
      const key = frame.dataset.thumbElement
      return key === undefined ? [] : [{ key, box: frame.getBoundingClientRect() }]
    }),
    x,
    y,
  )
}

export function liveHit(target: Element): GridHit {
  if (target.closest("[data-slide-number]") !== null) return "number"
  if (target.matches("[data-slide-paint], [data-grid-edit]")) return "blank"
  const text = target.closest<HTMLElement>('[contenteditable="true"]')
  if (text === null) return "element"
  return text.contains(document.activeElement) ? "typing" : "text"
}
