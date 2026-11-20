import { minimumSide } from "./box-gesture.js"
import type { PaintBox } from "./paint-box.js"

export type Area = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

export type CropDraft = { readonly frame: Area; readonly image: Area }

export type CropGrip = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"

export type CropSides = { readonly l: number; readonly t: number; readonly r: number; readonly b: number }

type Turn = Pick<PaintBox, "rotation" | "flipH" | "flipV">

const whole = 100_000

function covers(frame: Area, image: Area): boolean {
  return (
    image.x <= frame.x + 1 &&
    image.y <= frame.y + 1 &&
    image.x + image.width >= frame.x + frame.width - 1 &&
    image.y + image.height >= frame.y + frame.height - 1
  )
}

function coverOf(frame: Area, ratio: number): Area {
  const width = Math.max(frame.width, frame.height * ratio)
  const height = width / ratio
  return { x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2, width, height }
}

export function cropStart(width: number, height: number, placed: Area): CropDraft {
  const frame = { x: 0, y: 0, width, height }
  const image = {
    x: placed.x * width,
    y: placed.y * height,
    width: placed.width * width,
    height: placed.height * height,
  }
  return { frame, image: covers(frame, image) ? image : coverOf(frame, image.width / image.height) }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high)
}

function edges(
  start: number,
  size: number,
  imageStart: number,
  imageSize: number,
  delta: number,
  before: boolean,
  after: boolean,
): { readonly at: number; readonly size: number } {
  const least = Math.min(minimumSide, size)
  const end = start + size
  const from = before ? clamp(start + delta, imageStart, end - least) : start
  const to = after ? clamp(end + delta, from + least, imageStart + imageSize) : end
  return { at: from, size: to - from }
}

export function draggedCrop(start: CropDraft, grip: CropGrip, dx: number, dy: number): CropDraft {
  const { frame, image } = start
  if (grip === "move")
    return {
      frame,
      image: {
        ...image,
        x: clamp(image.x + dx, frame.x + frame.width - image.width, frame.x),
        y: clamp(image.y + dy, frame.y + frame.height - image.height, frame.y),
      },
    }
  const across = edges(frame.x, frame.width, image.x, image.width, dx, grip.includes("w"), grip.includes("e"))
  const down = edges(frame.y, frame.height, image.y, image.height, dy, grip.includes("n"), grip.includes("s"))
  return { frame: { x: across.at, y: down.at, width: across.size, height: down.size }, image }
}

function share(cut: number, size: number): number {
  return clamp(Math.round((cut * whole) / size), 0, whole)
}

export function cropOf(draft: CropDraft): CropSides {
  const { frame, image } = draft
  return {
    l: share(frame.x - image.x, image.width),
    t: share(frame.y - image.y, image.height),
    r: share(image.x + image.width - frame.x - frame.width, image.width),
    b: share(image.y + image.height - frame.y - frame.height, image.height),
  }
}

function turned(turn: Turn, x: number, y: number, back: boolean): { readonly x: number; readonly y: number } {
  const angle = ((back ? -turn.rotation : turn.rotation) * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

export function localStep(turn: Turn, dx: number, dy: number): { readonly x: number; readonly y: number } {
  const step = turned(turn, dx, dy, true)
  return { x: turn.flipH ? -step.x : step.x, y: turn.flipV ? -step.y : step.y }
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
