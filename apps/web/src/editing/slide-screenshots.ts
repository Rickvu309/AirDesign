import { screenshotBytes as screenshotLimit } from "@airdesign/catalog"

export const screenshotFit = { width: 1280, height: 720 } as const

export const screenshotQualities = [0.85, 0.6] as const

function base64(bytes: Uint8Array): string {
  let text = ""
  for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  return btoa(text)
}

async function encoded(canvas: OffscreenCanvas): Promise<string | null> {
  for (const quality of screenshotQualities) {
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality })
    const data = base64(new Uint8Array(await blob.arrayBuffer()))
    if (data.length <= screenshotLimit) return data
  }
  return null
}

export async function jpegOf(image: CanvasImageSource, width: number, height: number): Promise<string | null> {
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext("2d")
  if (context === null) return null
  context.fillStyle = "white"
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  context.getImageData(0, 0, 1, 1)
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  return encoded(canvas)
}
