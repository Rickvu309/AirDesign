import type { MediaType } from "./asset-ref.js"
import { limits } from "@airdesign/doom"

export type PixelSize = { readonly width: number; readonly height: number }

const signatures: readonly (readonly [MediaType, readonly number[]])[] = [
  ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/gif", [0x47, 0x49, 0x46, 0x38]],
]

const frameMarkers: ReadonlySet<number> = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
])

export function mediaTypeOf(bytes: Uint8Array): MediaType | null {
  for (const [type, signature] of signatures) {
    if (bytes.length >= signature.length && signature.every((byte, at) => bytes[at] === byte)) return type
  }
  return null
}

function jpegSize(bytes: Uint8Array, view: DataView): PixelSize | null {
  let at = 2
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return null
    const marker = bytes[at + 1] ?? 0
    const length = view.getUint16(at + 2)
    if (length < 2 || at + 2 + length > bytes.length) return null
    if (frameMarkers.has(marker) && length >= 7)
      return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) }
    at += 2 + length
  }
  return null
}

export function mediaSize(bytes: Uint8Array): PixelSize | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const type = mediaTypeOf(bytes)
  const size =
    type === "image/png" && bytes.length >= 24
      ? { width: view.getUint32(16), height: view.getUint32(20) }
      : type === "image/gif" && bytes.length >= 10
        ? { width: view.getUint16(6, true), height: view.getUint16(8, true) }
        : type === "image/jpeg"
          ? jpegSize(bytes, view)
          : null
  return size !== null && size.width > 0 && size.height > 0 ? size : null
}

export function overPixelLimit(size: PixelSize): boolean {
  return size.width * size.height > limits.pixels
}
