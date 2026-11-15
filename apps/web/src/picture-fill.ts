import { drawablePicture, type PaintElement } from "@airdesign/pptx"

export type PictureImage = NonNullable<PaintElement["image"]>

export type PictureSource = (image: PictureImage) => string | null

export type PictureSources = {
  readonly src: PictureSource
  release(): void
  carried(parts: ReadonlyMap<string, Uint8Array>): PictureSources
}

export type PictureAddress = { create(blob: Blob): string; revoke(url: string): void }

const drawable = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/bmp",
  "image/webp",
  "image/svg+xml",
  "image/avif",
])

const browserAddress: PictureAddress = {
  create: (blob) => URL.createObjectURL(blob),
  revoke: (url) => URL.revokeObjectURL(url),
}

type Made = { readonly bytes: Uint8Array; readonly url: string }

function copied(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}

function drawnBlob(bytes: Uint8Array): Blob | null {
  const drawn = drawablePicture(bytes)
  if (drawn === null) return null
  return new Blob([typeof drawn.data === "string" ? drawn.data : copied(drawn.data)], { type: drawn.contentType })
}

export function pictureSources(
  parts: ReadonlyMap<string, Uint8Array>,
  address: PictureAddress = browserAddress,
  kept: ReadonlyMap<string, Made> = new Map(),
): PictureSources {
  const made = new Map(kept)
  return {
    src(image) {
      const known = made.get(image.part)
      if (known !== undefined) return known.url
      const type = image.contentType?.toLowerCase() ?? ""
      const bytes = parts.get(image.part)
      if (bytes === undefined) return null
      const blob = drawable.has(type) ? new Blob([copied(bytes)], { type }) : drawnBlob(bytes)
      if (blob === null) return null
      const url = address.create(blob)
      made.set(image.part, { bytes, url })
      return url
    },
    release() {
      for (const each of made.values()) address.revoke(each.url)
      made.clear()
    },
    carried(next) {
      const handed = new Map<string, Made>()
      for (const [part, each] of made) {
        if (next.get(part) !== each.bytes) continue
        handed.set(part, each)
        made.delete(part)
      }
      return pictureSources(next, address, handed)
    },
  }
}

function percent(value: number): string {
  return `${Number((value * 100).toFixed(4))}%`
}

function axis(before: number, after: number): { readonly size: string; readonly position: string } | null {
  const shown = 1 - before - after
  if (shown <= 0) return null
  const cut = before + after
  return { size: percent(1 / shown), position: percent(cut === 0 ? 0 : before / cut) }
}

export function pictureLayer(image: PictureImage, src: string): string | null {
  const url = `url(${JSON.stringify(src)})`
  if (image.tile) return `${url} 0% 0% / auto repeat`
  const across = axis(image.crop.left, image.crop.right)
  const down = axis(image.crop.top, image.crop.bottom)
  if (across === null || down === null) return null
  return `${url} ${across.position} ${down.position} / ${across.size} ${down.size} no-repeat`
}
