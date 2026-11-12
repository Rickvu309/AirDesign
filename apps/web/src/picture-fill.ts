import type { PaintElement } from "@airdesign/pptx"

export type PictureImage = NonNullable<PaintElement["image"]>

export type PictureSource = (image: PictureImage) => string | null

export type PictureSources = { readonly src: PictureSource; release(): void }

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

export function pictureSources(
  parts: ReadonlyMap<string, Uint8Array>,
  address: PictureAddress = browserAddress,
): PictureSources {
  const made = new Map<string, string>()
  return {
    src(image) {
      const known = made.get(image.part)
      if (known !== undefined) return known
      const type = image.contentType?.toLowerCase() ?? ""
      const bytes = parts.get(image.part)
      if (!drawable.has(type) || bytes === undefined) return null
      const copy = new Uint8Array(bytes.byteLength)
      copy.set(bytes)
      const url = address.create(new Blob([copy], { type }))
      made.set(image.part, url)
      return url
    },
    release() {
      for (const url of made.values()) address.revoke(url)
      made.clear()
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
