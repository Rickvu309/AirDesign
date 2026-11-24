import * as doom from "@airdesign/doom"
import { propOf } from "@airdesign/doom"
import { invert, linear, type Point, type SlideGeometry } from "./slide-geometry"

export type CropGrip =
  | "crop-move"
  | "crop-n"
  | "crop-s"
  | "crop-e"
  | "crop-w"
  | "crop-ne"
  | "crop-nw"
  | "crop-se"
  | "crop-sw"

export type Area = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
type Natural = { readonly width: number; readonly height: number }
type Edges = { readonly north: boolean; readonly east: boolean; readonly south: boolean; readonly west: boolean }

const smallest = 16
const precision = 100_000

export const isCropGrip = (grip: string): grip is CropGrip => grip.startsWith("crop-")

const edgesOf = (grip: CropGrip): Edges => {
  const name = grip.slice("crop-".length)
  return { north: name.includes("n"), east: name.includes("e"), south: name.includes("s"), west: name.includes("w") }
}

function pictureIn(view: doom.Doom, id: doom.NodeId) {
  const fills = propOf(view.nodes.get(id), "fills") ?? []
  const at = fills.findLastIndex((paint) => paint.kind === "image" && paint.visible !== false)
  const paint = fills[at]
  return paint?.kind === "image" ? { fills, at, paint } : null
}

export const croppedPaint = (view: doom.Doom, id: doom.NodeId): doom.ImagePaint | null => {
  const held = pictureIn(view, id)
  return held !== null && held.paint.fit === "crop" ? held.paint : null
}

export function fitWrites(view: doom.Doom, id: doom.NodeId, fit: doom.ImagePaint["fit"]): readonly doom.Write[] {
  const held = pictureIn(view, id)
  if (held === null) return []
  const { crop: _crop, ...plain } = held.paint
  const next: doom.ImagePaint = fit === "crop" ? { ...held.paint, fit } : { ...plain, fit }
  return [{ node: id, prop: "fills", value: held.fills.map((paint, at) => (at === held.at ? next : paint)) }]
}

export const cropModeWrites = (view: doom.Doom, id: doom.NodeId) => fitWrites(view, id, "crop")

export function cropShown(view: doom.Doom, id: doom.NodeId, natural: Natural | null): doom.ImageCrop | null {
  const held = pictureIn(view, id)
  const box = propOf(view.nodes.get(id), "box")
  if (held === null || box === undefined) return null
  if (held.paint.crop !== undefined) return held.paint.crop
  return natural === null ? null : doom.coverCrop(box, natural)
}

export function imageArea(box: { readonly w: number; readonly h: number }, shown: doom.ImageCrop): Area {
  const width = box.w / shown.w
  const height = box.h / shown.h
  return { x: -shown.x * width, y: -shown.y * height, width, height }
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high)

type Span = { readonly start: number; readonly size: number }

function edge(start: number, size: number, image: Span, delta: number, before: boolean, after: boolean) {
  const least = Math.min(smallest, size)
  const end = start + size
  const from = before ? clamp(start + delta, image.start, end - least) : start
  const to = after ? clamp(end + delta, from + least, image.start + image.size) : end
  return { at: from, size: to - from }
}

function dragged(frame: Area, image: Area, grip: CropGrip, dx: number, dy: number): { frame: Area; image: Area } {
  if (grip === "crop-move")
    return {
      frame,
      image: {
        ...image,
        x: clamp(image.x + dx, frame.x + frame.width - image.width, frame.x),
        y: clamp(image.y + dy, frame.y + frame.height - image.height, frame.y),
      },
    }
  const sides = edgesOf(grip)
  const across = edge(frame.x, frame.width, { start: image.x, size: image.width }, dx, sides.west, sides.east)
  const down = edge(frame.y, frame.height, { start: image.y, size: image.height }, dy, sides.north, sides.south)
  return { frame: { x: across.at, y: down.at, width: across.size, height: down.size }, image }
}

const opposite: Readonly<Record<string, string>> = { e: "w", w: "e", n: "s", s: "n" }

function mirrored(grip: CropGrip, across: boolean, down: boolean): CropGrip {
  if (grip === "crop-move") return grip
  const letters = grip.slice("crop-".length).split("")
  const turned = letters.map((letter) => {
    const flips = letter === "e" || letter === "w" ? across : down
    return flips ? (opposite[letter] ?? letter) : letter
  })
  return `crop-${turned.join("")}` as CropGrip
}

const tidy = (value: number) => clamp(Math.round(value * precision) / precision, 0, 1)

export function cropDrag(args: {
  readonly view: doom.Doom
  readonly geometry: SlideGeometry
  readonly node: doom.NodeId
  readonly grip: CropGrip
  readonly origin: Point
  readonly at: Point
  readonly natural: Natural | null
}): readonly doom.Write[] {
  const { view, node, grip } = args
  const placed = args.geometry.byId.get(node)
  const held = pictureIn(view, node)
  const box = propOf(view.nodes.get(node), "box")
  const shown = cropShown(view, node, args.natural)
  if (placed === undefined || held === null || box === undefined || shown === null) return []
  const step = linear(invert(placed.matrix), { x: args.at.x - args.origin.x, y: args.at.y - args.origin.y })
  const dx = box.flipH ? -step.x : step.x
  const dy = box.flipV ? -step.y : step.y
  const frame: Area = { x: 0, y: 0, width: box.w, height: box.h }
  const done = dragged(frame, imageArea(box, shown), mirrored(grip, box.flipH, box.flipV), dx, dy)
  const window: doom.ImageCrop = {
    x: tidy((done.frame.x - done.image.x) / done.image.width),
    y: tidy((done.frame.y - done.image.y) / done.image.height),
    w: tidy(done.frame.width / done.image.width),
    h: tidy(done.frame.height / done.image.height),
  }
  const fills = held.fills.map((paint, at) =>
    at === held.at ? { ...held.paint, fit: "crop" as const, crop: window } : paint,
  )
  const writes: doom.Write[] = [{ node, prop: "fills", value: fills }]
  if (grip === "crop-move") return writes
  const width = Math.round(done.frame.width)
  const height = Math.round(done.frame.height)
  const left = box.flipH ? box.w - (done.frame.x + done.frame.width) : done.frame.x
  const top = box.flipV ? box.h - (done.frame.y + done.frame.height) : done.frame.y
  const shiftX = left + done.frame.width / 2 - box.w / 2
  const shiftY = top + done.frame.height / 2 - box.h / 2
  const turn = (box.rotation * Math.PI) / 180
  const centre = {
    x: box.x + box.w / 2 + shiftX * Math.cos(turn) - shiftY * Math.sin(turn),
    y: box.y + box.h / 2 + shiftX * Math.sin(turn) + shiftY * Math.cos(turn),
  }
  const next = {
    ...box,
    x: Math.round(centre.x - width / 2),
    y: Math.round(centre.y - height / 2),
    w: width,
    h: height,
  }
  return [...writes, { node, prop: "box", value: next }]
}
