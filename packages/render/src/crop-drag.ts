import type { PaintBox } from "./paint-box.js"

export type Area = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

type Turn = Pick<PaintBox, "rotation" | "flipH" | "flipV">

function turned(turn: Turn, x: number, y: number, back: boolean): { readonly x: number; readonly y: number } {
  const angle = ((back ? -turn.rotation : turn.rotation) * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

export function placedFrame(box: PaintBox, frame: Area): Area {
  const offset = {
    x: frame.x + frame.width / 2 - box.width / 2,
    y: frame.y + frame.height / 2 - box.height / 2,
  }
  const moved = turned(box, box.flipH ? -offset.x : offset.x, box.flipV ? -offset.y : offset.y, false)
  const width = Math.round(frame.width)
  const height = Math.round(frame.height)
  return {
    x: Math.round(box.x + box.width / 2 + moved.x - width / 2),
    y: Math.round(box.y + box.height / 2 + moved.y - height / 2),
    width,
    height,
  }
}
