import { readSlides, type MaskRun } from "@airdesign/pptx"
import { paintStore, type CanvasElement, type CanvasSlide } from "@airdesign/render"
import { paint } from "@/deck-paint"
import { busyElements } from "@/live-repaint"
import type { MaskPicture } from "@/export/mask-bake"
import { paintedPicture } from "@/painted-picture"

type Parts = ReadonlyMap<string, Uint8Array>

const inch = 914_400
const dots = 192
const longest = 4_096

function spanAt(elements: readonly CanvasElement[], at: number): number {
  return 1 + Math.min(elements[at]?.held ?? 0, elements.length - at - 1)
}

export function runElements(slide: CanvasSlide, part: string, run: MaskRun): readonly CanvasElement[] {
  const keys = new Set(run.run.map((id) => `${part}#${id}`))
  const start = slide.elements.findIndex((each) => each.key === `${part}#${run.mask}`)
  if (start < 0) throw new Error("mask-picture")
  let end = start
  while (end < slide.elements.length && keys.has(slide.elements[end]!.key)) end += spanAt(slide.elements, end)
  return slide.elements.slice(start, end)
}

export function maskPicture(): MaskPicture {
  return async (parts: Parts, part: string, run: MaskRun) => {
    const store = paintStore()
    const painted = paint(store, parts, null, busyElements())
    const slide = painted.canvases(readSlides(parts).findIndex((each) => each.part === part))
    if (slide === null) throw new Error("mask-picture")
    const elements = runElements(slide, part, run)
    const mask = elements[0]?.box
    if (mask === undefined || mask === null) throw new Error("mask-picture")
    const fit = Math.min(1, longest / ((Math.max(mask.width, mask.height) / inch) * dots))
    const scale = (dots / inch) * fit
    const { image, width, height } = await paintedPicture(store, slide, elements, scale)
    const across = Math.max(1, Math.round(mask.width * scale))
    const down = Math.max(1, Math.round(mask.height * scale))
    const canvas = new OffscreenCanvas(across, down)
    const context = canvas.getContext("2d")
    if (context === null) throw new Error("mask-picture")
    context.translate(across / 2, down / 2)
    if (mask.flipH || mask.flipV) context.scale(mask.flipH ? -1 : 1, mask.flipV ? -1 : 1)
    context.rotate((-mask.rotation * Math.PI) / 180)
    context.translate(-(mask.x + mask.width / 2) * scale, -(mask.y + mask.height / 2) * scale)
    context.drawImage(image, 0, 0, width, height)
    const blob = await canvas.convertToBlob({ type: "image/png" })
    return new Uint8Array(await blob.arrayBuffer())
  }
}
