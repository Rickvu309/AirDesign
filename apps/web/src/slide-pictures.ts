import { pictureBytes as pictureLimit } from "@airdesign/catalog"
import type { Register, SlideId } from "@airdesign/document"
import { paintStore } from "@airdesign/render"
import { paint } from "@/deck-paint"
import type { PictureBytes } from "@/exported-parts"
import { busyElements } from "@/live-repaint"
import { paintedPicture } from "@/painted-picture"

type Parts = ReadonlyMap<string, Uint8Array>

export const pictureFit = { width: 1280, height: 720 } as const

export const pictureQualities = [0.85, 0.6] as const

function base64(bytes: Uint8Array): string {
  let text = ""
  for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  return btoa(text)
}

async function encoded(canvas: OffscreenCanvas): Promise<string | null> {
  for (const quality of pictureQualities) {
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality })
    const data = base64(new Uint8Array(await blob.arrayBuffer()))
    if (data.length <= pictureLimit) return data
  }
  return null
}

export async function slidePicture(
  parts: Parts,
  register: Register,
  pictures: PictureBytes,
  slide: SlideId,
): Promise<string | null> {
  const store = paintStore()
  const painted = paint(store, parts, register, busyElements(), pictures)
  try {
    const index = painted.slides.findIndex(({ shapes }) => shapes.slide === slide)
    const shown = index < 0 ? null : painted.canvases(index)
    if (shown === null) return null
    const scale = Math.min(pictureFit.width / shown.width, pictureFit.height / shown.height)
    const { image, width, height } = await paintedPicture(store, shown, shown.elements, scale, true)
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext("2d")
    if (context === null) return null
    context.fillStyle = "white"
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return await encoded(canvas)
  } finally {
    painted.pictures.release()
  }
}
