import { limits, mediaSize, mediaTypeOf, overPixelLimit, type MediaType } from "@airdesign/document"

export type PictureRefusal = "type" | "size" | "unread"

export type PictureFile = {
  readonly bytes: Uint8Array
  readonly type: MediaType
  readonly width: number
  readonly height: number
}

export function pictureRefusal(bytes: Uint8Array): PictureRefusal | null {
  if (mediaTypeOf(bytes) === null) return "type"
  if (bytes.byteLength >= limits.media) return "size"
  const size = mediaSize(bytes)
  return size !== null && overPixelLimit(size) ? "size" : null
}

export async function readPicture(file: Blob): Promise<PictureFile | PictureRefusal> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const refusal = pictureRefusal(bytes)
  const type = mediaTypeOf(bytes)
  if (refusal !== null || type === null) return refusal ?? "type"
  try {
    const image = await createImageBitmap(new Blob([bytes], { type }))
    const size = { width: image.width, height: image.height }
    image.close()
    return { bytes, type, ...size }
  } catch {
    return "unread"
  }
}
