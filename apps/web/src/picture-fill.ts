import { drawablePicture, iconOfPart, rasterDimensions, type PaintElement } from "@airdesign/pptx"
import { redrawnIcon } from "@/icon-redraw"

export type PictureImage = NonNullable<PaintElement["image"]>

type Dimensions = { readonly width: number; readonly height: number }

export type PictureSource = ((image: PictureImage) => string | null) & {
  dimensions?(image: PictureImage): Dimensions | null
}

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

type Made = { readonly bytes: Uint8Array; readonly url: string; size?: Dimensions | null }

const iconPrefix = "data:image/svg+xml;charset=utf-8,"

function iconAddress(bytes: Uint8Array): string {
  return `${iconPrefix}${encodeURIComponent(new TextDecoder().decode(bytes))}`
}

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
  const src: PictureSource = (image) => {
    const known = made.get(image.part)
    if (known !== undefined) return known.url
    const type = image.contentType?.toLowerCase() ?? ""
    const bytes = parts.get(image.part) ?? redrawnIcon(image.part, parts)
    if (bytes === undefined) return null
    if (iconOfPart(image.part) !== null && type === "image/svg+xml") {
      const url = iconAddress(bytes)
      made.set(image.part, { bytes, url })
      return url
    }
    const blob = drawable.has(type) ? new Blob([copied(bytes)], { type }) : drawnBlob(bytes)
    if (blob === null) return null
    const url = address.create(blob)
    made.set(image.part, { bytes, url })
    return url
  }
  src.dimensions = (image) => {
    if (!image.tile) return null
    const held = made.get(image.part)
    if (held === undefined) return null
    if (held.size === undefined) held.size = rasterDimensions(held.bytes)
    return held.size
  }
  return {
    src,
    release() {
      for (const each of made.values()) if (!each.url.startsWith(iconPrefix)) address.revoke(each.url)
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

function span(
  before: number,
  after: number,
  start = 0,
  end = 0,
): { readonly size: number; readonly offset: number } | null {
  const shown = 1 - before - after
  if (shown <= 0) return null
  const size = (1 - start - end) / shown
  return { size, offset: start - before * size }
}

function axis(
  before: number,
  after: number,
  start = 0,
  end = 0,
): { readonly size: string; readonly position: string } | null {
  const placed = span(before, after, start, end)
  if (placed === null) return null
  const position = placed.size === 1 ? 0 : placed.offset / (1 - placed.size)
  return { size: percent(placed.size), position: percent(position) }
}

export function pictureFrame(
  image: PictureImage,
  canvas: { readonly width: number; readonly height: number },
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null {
  if (image.tile) return null
  const across = span(image.crop.left, image.crop.right, image.destination?.left, image.destination?.right)
  const down = span(image.crop.top, image.crop.bottom, image.destination?.top, image.destination?.bottom)
  if (across === null || down === null) return null
  const width = across.size * canvas.width
  const height = down.size * canvas.height
  const positionX = across.size === 1 ? 0 : across.offset / (1 - across.size)
  const positionY = down.size === 1 ? 0 : down.offset / (1 - down.size)
  return { x: positionX * (canvas.width - width), y: positionY * (canvas.height - height), width, height }
}

export function pictureLayer(image: PictureImage, src: string, size?: Dimensions | null): string | null {
  const url = `url(${JSON.stringify(src)})`
  if (image.tile) {
    const scale = image.tileScale ?? { x: 1, y: 1 }
    const tile =
      size == null
        ? "auto"
        : `calc(${size.width * scale.x}px * var(--tile-slide-scale, 1)) calc(${size.height * scale.y}px * var(--tile-slide-scale, 1))`
    return `${url} 0% 0% / ${tile} repeat`
  }
  const across = axis(image.crop.left, image.crop.right, image.destination?.left, image.destination?.right)
  const down = axis(image.crop.top, image.crop.bottom, image.destination?.top, image.destination?.bottom)
  if (across === null || down === null) return null
  return `${url} ${across.position} ${down.position} / ${across.size} ${down.size} no-repeat`
}
