import type { ElementId } from "@airdesign/document"
import { paintStore, type CanvasElement, type PaintBox } from "@airdesign/render"
import { paint } from "@/deck-paint"
import { busyElements } from "@/editing/live-repaint"
import { paintedPicture } from "@/editing/painted-picture"

type Parts = ReadonlyMap<string, Uint8Array>

const pixelsPerEmu = 2 / 9525

type Bounds = { readonly x: number; readonly y: number; readonly right: number; readonly bottom: number }

function turnedBounds(box: PaintBox): Bounds {
  const turn = (box.rotation * Math.PI) / 180
  const across = Math.abs(box.width * Math.cos(turn)) + Math.abs(box.height * Math.sin(turn))
  const down = Math.abs(box.width * Math.sin(turn)) + Math.abs(box.height * Math.cos(turn))
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  return { x: middle.x - across / 2, y: middle.y - down / 2, right: middle.x + across / 2, bottom: middle.y + down / 2 }
}

function chosen(elements: readonly CanvasElement[], ids: readonly ElementId[]): readonly CanvasElement[] {
  const kept: CanvasElement[] = []
  for (let at = 0; at < elements.length; at += 1) {
    const element = elements[at]
    if (element?.id === null || element?.id === undefined || !ids.includes(element.id)) continue
    const span = 1 + Math.min(element.held ?? 0, elements.length - at - 1)
    kept.push(...elements.slice(at, at + span))
    at += span - 1
  }
  return kept
}

export async function layersPng(parts: Parts, index: number, ids: readonly ElementId[]): Promise<Blob> {
  const store = paintStore()
  const slide = paint(store, parts, null, busyElements()).canvases(index)
  if (slide === null) throw new Error("layers-png")
  const elements = chosen(slide.elements, ids)
  const boxes = elements.flatMap((element) =>
    element.id !== null && ids.includes(element.id) && element.box !== null ? [turnedBounds(element.box)] : [],
  )
  if (boxes.length === 0) throw new Error("layers-png")
  const left = Math.min(...boxes.map((box) => box.x))
  const top = Math.min(...boxes.map((box) => box.y))
  const across = Math.max(1, Math.round((Math.max(...boxes.map((box) => box.right)) - left) * pixelsPerEmu))
  const down = Math.max(1, Math.round((Math.max(...boxes.map((box) => box.bottom)) - top) * pixelsPerEmu))
  const { image, width, height } = await paintedPicture(store, slide, elements, pixelsPerEmu)
  const canvas = new OffscreenCanvas(across, down)
  const context = canvas.getContext("2d")
  if (context === null) throw new Error("layers-png")
  context.drawImage(image, -left * pixelsPerEmu, -top * pixelsPerEmu, width, height)
  return canvas.convertToBlob({ type: "image/png" })
}
