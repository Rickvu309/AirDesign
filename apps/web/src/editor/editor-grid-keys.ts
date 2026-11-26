import type { GridRect } from "@/editor/grid-lines"

const rowSlack = 8

function center(box: GridRect): { readonly x: number; readonly y: number } {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

const moves = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"])

export function gridMove(key: string, boxes: readonly GridRect[], from: number): number | null {
  const count = boxes.length
  if (!moves.has(key)) return null
  if (count === 0 || from < 0 || from >= count) return from
  if (key === "Home") return 0
  if (key === "End") return count - 1
  if (key === "ArrowRight") return Math.min(from + 1, count - 1)
  if (key === "ArrowLeft") return Math.max(from - 1, 0)
  const origin = boxes[from]
  if (origin === undefined) return from
  const here = center(origin)
  const downward = key === "ArrowDown"
  let best = from
  let bestScore = Number.POSITIVE_INFINITY
  boxes.forEach((box, index) => {
    const point = center(box)
    const dy = point.y - here.y
    if (index === from || (downward ? dy <= rowSlack : dy >= -rowSlack)) return
    const score = Math.abs(dy) * 2 + Math.abs(point.x - here.x)
    if (score < bestScore) {
      bestScore = score
      best = index
    }
  })
  return best
}
