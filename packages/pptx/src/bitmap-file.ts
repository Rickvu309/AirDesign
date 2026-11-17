const fileHeaderBytes = 14
const coreHeaderBytes = 12
const infoHeaderBytes = 40
const fourHeaderBytes = 108
const bitfields = 3
const alphaBitfields = 6
const base64Letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

export type BitmapSize = { readonly width: number; readonly height: number }

const base64Codes = Uint8Array.from(base64Letters, (letter) => letter.charCodeAt(0))
const pad = 61
const spelledChunk = 32768

export function base64(bytes: Uint8Array): string {
  const codes = new Uint8Array(Math.ceil(bytes.length / 3) * 4)
  let out = 0
  for (let at = 0; at < bytes.length; at += 3) {
    const left = bytes.length - at
    const joined = ((bytes[at] ?? 0) << 16) | ((bytes[at + 1] ?? 0) << 8) | (bytes[at + 2] ?? 0)
    codes[out] = base64Codes[joined >> 18] ?? pad
    codes[out + 1] = base64Codes[(joined >> 12) & 63] ?? pad
    codes[out + 2] = left > 1 ? (base64Codes[(joined >> 6) & 63] ?? pad) : pad
    codes[out + 3] = left > 2 ? (base64Codes[joined & 63] ?? pad) : pad
    out += 4
  }
  const pieces: string[] = []
  for (let at = 0; at < codes.length; at += spelledChunk)
    pieces.push(String(Reflect.apply(String.fromCharCode, undefined, codes.subarray(at, at + spelledChunk))))
  return pieces.join("")
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

export function bitmapInfoBytes(info: Uint8Array): number | null {
  if (info.length < 4) return null
  const data = view(info)
  const size = data.getUint32(0, true)
  if (size === coreHeaderBytes && info.length >= coreHeaderBytes) {
    const count = data.getUint16(10, true)
    return size + (count <= 8 ? (1 << count) * 3 : 0)
  }
  if (size < infoHeaderBytes || info.length < infoHeaderBytes) return null
  const count = data.getUint16(14, true)
  const compression = data.getUint32(16, true)
  const used = data.getUint32(32, true)
  const colors = used > 0 ? used : count <= 8 ? 1 << count : 0
  const masks =
    size === infoHeaderBytes ? (compression === bitfields ? 12 : compression === alphaBitfields ? 16 : 0) : 0
  return size + masks + colors * 4
}

export function bitmapSize(info: Uint8Array): BitmapSize | null {
  if (info.length < coreHeaderBytes) return null
  const data = view(info)
  if (data.getUint32(0, true) === coreHeaderBytes)
    return { width: data.getUint16(4, true), height: data.getUint16(6, true) }
  if (info.length < infoHeaderBytes) return null
  return { width: data.getInt32(4, true), height: data.getInt32(8, true) }
}

export function bitmapFile(info: Uint8Array, pixels: Uint8Array): Uint8Array {
  const file = new Uint8Array(fileHeaderBytes + info.length + pixels.length)
  const data = view(file)
  file[0] = 0x42
  file[1] = 0x4d
  data.setUint32(2, file.length, true)
  data.setUint32(10, fileHeaderBytes + info.length, true)
  file.set(info, fileHeaderBytes)
  file.set(pixels, fileHeaderBytes + info.length)
  return file
}

export function rgbaFile(size: BitmapSize, rgba: Uint8Array): Uint8Array {
  const info = new Uint8Array(fourHeaderBytes)
  const data = view(info)
  data.setUint32(0, fourHeaderBytes, true)
  data.setInt32(4, size.width, true)
  data.setInt32(8, -size.height, true)
  data.setUint16(12, 1, true)
  data.setUint16(14, 32, true)
  data.setUint32(16, bitfields, true)
  data.setUint32(20, size.width * size.height * 4, true)
  data.setUint32(40, 0x00ff0000, true)
  data.setUint32(44, 0x0000ff00, true)
  data.setUint32(48, 0x000000ff, true)
  data.setUint32(52, 0xff000000, true)
  data.setUint32(56, 0x73524742, true)
  const pixels = new Uint8Array(size.width * size.height * 4)
  for (let at = 0; at + 3 < pixels.length; at += 4) {
    pixels[at] = rgba[at + 2] ?? 0
    pixels[at + 1] = rgba[at + 1] ?? 0
    pixels[at + 2] = rgba[at] ?? 0
    pixels[at + 3] = rgba[at + 3] ?? 0
  }
  return bitmapFile(info, pixels)
}

export type Pixels = BitmapSize & { readonly rgba: Uint8Array }

function masked(value: number, mask: number): number {
  if (mask === 0) return 0
  let shift = 0
  while (((mask >>> shift) & 1) === 0) shift += 1
  const top = mask >>> shift
  return Math.round((((value & mask) >>> shift) * 255) / top)
}

export function filePixels(file: Uint8Array): Pixels | null {
  if (file.length < fileHeaderBytes + infoHeaderBytes) return null
  const data = view(file)
  const start = data.getUint32(10, true)
  const info = file.subarray(fileHeaderBytes, start)
  if (info.length < infoHeaderBytes || data.getUint32(fileHeaderBytes, true) < infoHeaderBytes) return null
  const header = view(info)
  const width = header.getInt32(4, true)
  const tall = header.getInt32(8, true)
  const count = header.getUint16(14, true)
  const compression = header.getUint32(16, true)
  const height = Math.abs(tall)
  if (width < 1 || height < 1 || width * height > 1 << 24) return null
  if (compression !== 0 && !(compression === bitfields && (count === 16 || count === 32))) return null
  const headerSize = header.getUint32(0, true)
  const masks =
    compression === bitfields && info.length >= infoHeaderBytes + 12
      ? [header.getUint32(40, true), header.getUint32(44, true), header.getUint32(48, true)]
      : count === 16
        ? [0x7c00, 0x03e0, 0x001f]
        : [0xff0000, 0x00ff00, 0x0000ff]
  const alpha = compression === bitfields && headerSize >= 56 && count === 32 ? header.getUint32(52, true) : 0
  const paletteAt = headerSize + (headerSize === infoHeaderBytes && compression === bitfields ? 12 : 0)
  const stride = Math.floor((width * count + 31) / 32) * 4
  const pixels = file.subarray(start)
  const words = view(pixels)
  if (![1, 4, 8, 16, 24, 32].includes(count) || pixels.length < stride * height) return null
  const rgba = new Uint8Array(width * height * 4).fill(255)
  for (let row = 0; row < height; row += 1) {
    const line = (tall > 0 ? height - 1 - row : row) * stride
    for (let column = 0; column < width; column += 1) {
      const out = (row * width + column) * 4
      if (count <= 8) {
        const bit = column * count
        const index = ((pixels[line + (bit >> 3)] ?? 0) >> (8 - count - (bit & 7))) & ((1 << count) - 1)
        const entry = paletteAt + index * 4
        rgba[out] = info[entry + 2] ?? 0
        rgba[out + 1] = info[entry + 1] ?? 0
        rgba[out + 2] = info[entry] ?? 0
      } else if (count === 24) {
        const at = line + column * 3
        rgba[out] = pixels[at + 2] ?? 0
        rgba[out + 1] = pixels[at + 1] ?? 0
        rgba[out + 2] = pixels[at] ?? 0
      } else {
        const at = line + (column * count) / 8
        const value = count === 16 ? words.getUint16(at, true) : words.getUint32(at, true)
        rgba[out] = masked(value, masks[0] ?? 0)
        rgba[out + 1] = masked(value, masks[1] ?? 0)
        rgba[out + 2] = masked(value, masks[2] ?? 0)
        if (alpha !== 0) rgba[out + 3] = masked(value, alpha)
      }
    }
  }
  return { width, height, rgba }
}
