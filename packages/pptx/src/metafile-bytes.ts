import { bitmapFile, bitmapSize } from "./bitmap-file.js"
import type { Bitmap } from "./metafile-play.js"
import { colorOf, type Box, type Font, type Point } from "./metafile-state.js"

const spelledChunk = 4096

function spelled(units: readonly number[]): string {
  const pieces: string[] = []
  for (let at = 0; at < units.length; at += spelledChunk)
    pieces.push(String.fromCharCode(...units.slice(at, at + spelledChunk)))
  return pieces.join("")
}

export class MetafileBytes {
  readonly bytes: Uint8Array
  private readonly data: DataView

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
    this.data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  has(at: number, size: number): boolean {
    return at >= 0 && size >= 0 && at + size <= this.bytes.length
  }

  u8(at: number): number {
    return this.has(at, 1) ? this.data.getUint8(at) : 0
  }

  u16(at: number): number {
    return this.has(at, 2) ? this.data.getUint16(at, true) : 0
  }

  i16(at: number): number {
    return this.has(at, 2) ? this.data.getInt16(at, true) : 0
  }

  u32(at: number): number {
    return this.has(at, 4) ? this.data.getUint32(at, true) : 0
  }

  i32(at: number): number {
    return this.has(at, 4) ? this.data.getInt32(at, true) : 0
  }

  f32(at: number): number {
    const value = this.has(at, 4) ? this.data.getFloat32(at, true) : 0
    return Number.isFinite(value) ? value : 0
  }

  color(at: number): string {
    return colorOf(this.u32(at))
  }

  box32(at: number): Box {
    return { left: this.i32(at), top: this.i32(at + 4), right: this.i32(at + 8), bottom: this.i32(at + 12) }
  }

  points(at: number, count: number, wide: boolean): Point[] {
    const size = wide ? 8 : 4
    const points: Point[] = []
    if (count < 0 || !this.has(at, count * size)) return points
    for (let index = 0; index < count; index += 1) {
      const spot = at + index * size
      points.push(wide ? [this.i32(spot), this.i32(spot + 4)] : [this.i16(spot), this.i16(spot + 2)])
    }
    return points
  }

  utf16(at: number, count: number): string {
    const units: number[] = []
    for (let index = 0; index < count && this.has(at + index * 2, 2); index += 1) units.push(this.u16(at + index * 2))
    return spelled(units)
  }

  latin(at: number, count: number): string {
    const units: number[] = []
    for (let index = 0; index < count && this.has(at + index, 1); index += 1) units.push(this.u8(at + index))
    return spelled(units)
  }

  bitmap(info: number, infoBytes: number, pixels: number, pixelBytes: number): Bitmap | null {
    if (infoBytes <= 0 || !this.has(info, infoBytes) || !this.has(pixels, pixelBytes)) return null
    const header = this.bytes.subarray(info, info + infoBytes)
    const size = bitmapSize(header)
    if (size === null || size.width === 0 || size.height === 0) return null
    return {
      file: bitmapFile(header, this.bytes.subarray(pixels, pixels + pixelBytes)),
      width: Math.abs(size.width),
      height: Math.abs(size.height),
      bottomUp: size.height > 0,
    }
  }

  font(at: number, face: string): Font {
    return {
      kind: "font",
      height: this.i32(at),
      escapement: this.i32(at + 8),
      weight: this.i32(at + 16),
      italic: this.u8(at + 20) !== 0,
      underline: this.u8(at + 21) !== 0,
      strike: this.u8(at + 22) !== 0,
      family: this.u8(at + 27),
      face: face.split("\u0000")[0] ?? "",
    }
  }
}

export function sourceBox(bitmap: Bitmap, box: Box, fromBottom: boolean): Box {
  const width = box.right - box.left
  const height = box.bottom - box.top
  if (width <= 0 || height <= 0) return { left: 0, top: 0, right: bitmap.width, bottom: bitmap.height }
  if (!fromBottom || !bitmap.bottomUp) return box
  const top = bitmap.height - box.top - height
  return { left: box.left, top, right: box.right, bottom: top + height }
}
