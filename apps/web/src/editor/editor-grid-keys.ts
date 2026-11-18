import { slideKey } from "@/editor/slide-keys"

export type GridBox = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

export type GridCommand = "open" | "remove" | "clone" | "earlier" | "later"

const rowSlack = 8

function center(box: GridBox): { readonly x: number; readonly y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

export function gridMove(key: string, boxes: readonly GridBox[], from: number): number {
  const count = boxes.length
  if (count === 0 || from < 0 || from >= count) return from
  if (key === "Home") return 0
  if (key === "End") return count - 1
  if (key === "ArrowRight") return Math.min(from + 1, count - 1)
  if (key === "ArrowLeft") return Math.max(from - 1, 0)
  if (key !== "ArrowDown" && key !== "ArrowUp") return from
  const origin = boxes[from]
  if (origin === undefined) return from
  const here = center(origin)
  const downward = key === "ArrowDown"
  let best = from
  let bestScore = Number.POSITIVE_INFINITY
  for (let index = 0; index < count; index += 1) {
    if (index === from) continue
    const box = boxes[index]
    if (box === undefined) continue
    const point = center(box)
    const dy = point.y - here.y
    if (downward ? dy <= rowSlack : dy >= -rowSlack) continue
    const score = Math.abs(dy) * 2 + Math.abs(point.x - here.x)
    if (score < bestScore) {
      bestScore = score
      best = index
    }
  }
  return best
}

export function gridCommand(event: {
  readonly key: string
  readonly code?: string
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
}): GridCommand | null {
  if (!event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.key === "Enter") return "open"
  const change = slideKey(event)
  if (change === "remove" || change === "clone") return change
  if (change === "up") return "earlier"
  if (change === "down") return "later"
  if (event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.key === "ArrowLeft") return "earlier"
  if (event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.key === "ArrowRight") return "later"
  return null
}

export function gridMoveAt(held: readonly number[], count: number, direction: "earlier" | "later"): number | null {
  const first = held[0]
  const last = held.at(-1)
  if (first === undefined || last === undefined) return null
  if (direction === "earlier") return first > 0 ? first - 1 : null
  return last < count - 1 ? last + 2 : null
}

const moveKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]

export function focusMove(list: HTMLElement, key: string): number | null {
  if (!moveKeys.includes(key)) return null
  const buttons = [...list.querySelectorAll<HTMLElement>("[data-slide-entry]")]
  const at = buttons.findIndex((button) => button === document.activeElement)
  if (at === -1) return null
  const boxes = buttons.map((button) => {
    const rect = button.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  const next = gridMove(key, boxes, at)
  buttons[next]?.focus()
  return Number(buttons[next]?.dataset.slideEntry ?? next + 1) - 1
}
