import {
  extensionDrops,
  paintReader,
  readSlides,
  writtenStandIn,
  type PaintBox,
  type PaintShadow,
} from "@airdesign/pptx"
import { cssColor } from "@/paint-css"

const inch = 914_400
const dots = 192
const longest = 4_096

function canvasSize(box: PaintBox): { readonly width: number; readonly height: number } {
  const width = (box.width / inch) * dots
  const height = (box.height / inch) * dots
  if (!(width > 0) || !(height > 0)) throw new Error("shadow-bake")
  const long = Math.max(width, height)
  const scale = long > longest ? longest / long : 1
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function shift(direction: number, distance: number): { readonly x: number; readonly y: number } {
  const turn = (direction * Math.PI) / 180
  return { x: Math.cos(turn) * distance, y: Math.sin(turn) * distance }
}

async function rasterDrops(box: PaintBox, drops: readonly PaintShadow[]): Promise<Uint8Array> {
  let pad = 0
  for (const drop of drops) pad = Math.max(pad, drop.blur + drop.distance)
  const padded = { ...box, width: box.width + pad * 2, height: box.height + pad * 2 }
  const size = canvasSize(padded)
  const scale = size.width / padded.width
  const canvas = new OffscreenCanvas(size.width, size.height)
  const out = canvas.getContext("2d")
  if (out === null) throw new Error("shadow-bake")
  const shapeX = pad * scale
  const shapeY = pad * scale
  const shapeW = box.width * scale
  const shapeH = box.height * scale
  for (const drop of drops) {
    const scratch = new OffscreenCanvas(size.width, size.height)
    const ctx = scratch.getContext("2d")
    if (ctx === null) throw new Error("shadow-bake")
    const blur = (drop.blur * scale) / 2
    const moved = shift(drop.direction, drop.distance * scale)
    if (blur > 0) ctx.filter = `blur(${String(blur)}px)`
    ctx.fillStyle = cssColor(drop.color)
    ctx.fillRect(shapeX + moved.x, shapeY + moved.y, shapeW, shapeH)
    out.drawImage(scratch, 0, 0)
  }
  const blob = await canvas.convertToBlob({ type: "image/png" })
  return new Uint8Array(await blob.arrayBuffer())
}

export async function bakeShadows(parts: ReadonlyMap<string, Uint8Array>): Promise<ReadonlyMap<string, Uint8Array>> {
  const reader = paintReader(parts)
  let next: ReadonlyMap<string, Uint8Array> = parts
  for (const slide of readSlides(parts)) {
    for (const row of reader.slide(slide.part).elements) {
      if (row.from !== "slide" || row.box === null) continue
      const at = { slide: slide.slide, part: slide.part, shape: row.shape }
      if (extensionDrops(next, at).length === 0) continue
      const drops = row.effects?.drops ?? []
      if (drops.length === 0 || row.box.width <= 0 || row.box.height <= 0) continue
      next = writtenStandIn(next, at, await rasterDrops(row.box, drops))
    }
  }
  return next
}
