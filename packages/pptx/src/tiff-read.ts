import { rgbaFile } from "./bitmap-file.js"
import { inflate } from "./part-inflate.js"

const largestSide = 16384
const tags = {
  width: 256,
  height: 257,
  bits: 258,
  compression: 259,
  photometric: 262,
  stripOffsets: 273,
  samples: 277,
  rowsPerStrip: 278,
  stripBytes: 279,
  planar: 284,
  predictor: 317,
  colorMap: 320,
  tileWidth: 322,
  tileHeight: 323,
  tileOffsets: 324,
  tileBytes: 325,
  extra: 338,
} as const
const typeBytes: Readonly<Record<number, number>> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  16: 8,
}

type Tiff = {
  readonly bytes: Uint8Array
  readonly data: DataView
  readonly little: boolean
}

type Field = readonly number[]

function fieldValues(tiff: Tiff, entry: number): Field {
  const { data, little } = tiff
  const type = data.getUint16(entry + 2, little)
  const count = data.getUint32(entry + 4, little)
  const size = typeBytes[type] ?? 0
  if (size === 0 || count > tiff.bytes.length) return []
  const start = size * count <= 4 ? entry + 8 : data.getUint32(entry + 8, little)
  if (start + size * count > tiff.bytes.length) return []
  const values: number[] = []
  for (let index = 0; index < count; index += 1) {
    const at = start + index * size
    if (size === 1) values.push(data.getUint8(at))
    else if (size === 2) values.push(data.getUint16(at, little))
    else if (size === 4) values.push(data.getUint32(at, little))
    else values.push(data.getUint32(at, little) / Math.max(1, data.getUint32(at + 4, little)))
  }
  return values
}

function fields(tiff: Tiff): ReadonlyMap<number, Field> | null {
  const { data, little } = tiff
  const directory = data.getUint32(4, little)
  if (directory + 2 > tiff.bytes.length) return null
  const count = data.getUint16(directory, little)
  if (directory + 2 + count * 12 > tiff.bytes.length) return null
  const found = new Map<number, Field>()
  for (let index = 0; index < count; index += 1) {
    const entry = directory + 2 + index * 12
    found.set(data.getUint16(entry, little), fieldValues(tiff, entry))
  }
  return found
}

function lzw(input: Uint8Array, size: number): Uint8Array {
  const output = new Uint8Array(size)
  const prefix = new Int16Array(4096).fill(-1)
  const suffix = new Uint8Array(4096)
  const first = new Uint8Array(4096)
  const lengths = new Uint16Array(4096)
  for (let code = 0; code < 256; code += 1) {
    suffix[code] = code
    first[code] = code
    lengths[code] = 1
  }
  let next = 258
  let width = 9
  let previous = -1
  let written = 0
  let held = 0
  let count = 0
  let read = 0
  while (written < size) {
    while (count < width && read < input.length) {
      held = ((held << 8) | (input[read] ?? 0)) & 0xffffff
      read += 1
      count += 8
    }
    if (count < width) break
    const code = (held >> (count - width)) & ((1 << width) - 1)
    count -= width
    if (code === 257) break
    if (code === 256) {
      next = 258
      width = 9
      previous = -1
      continue
    }
    const known = code < next
    if (!known && (code !== next || previous < 0)) break
    const spelled = known ? code : previous
    const length = lengths[spelled] ?? 0
    let at = written + length - 1
    for (let link = spelled; link >= 0; link = prefix[link] ?? -1) {
      if (at < size) output[at] = suffix[link] ?? 0
      at -= 1
    }
    const lead = first[spelled] ?? 0
    if (!known && written + length < size) output[written + length] = lead
    written += known ? length : length + 1
    if (previous >= 0 && next < 4096) {
      prefix[next] = previous
      suffix[next] = lead
      first[next] = first[previous] ?? 0
      lengths[next] = (lengths[previous] ?? 0) + 1
      next += 1
    }
    previous = code
    if (next + 1 >= 1 << width && width < 12) width += 1
  }
  return output
}

function packBits(input: Uint8Array, size: number): Uint8Array {
  const output = new Uint8Array(size)
  let written = 0
  let at = 0
  while (at < input.length && written < size) {
    const header = input[at] ?? 0
    at += 1
    if (header < 128) {
      const run = input.subarray(at, at + header + 1).subarray(0, size - written)
      output.set(run, written)
      written += run.length
      at += header + 1
    } else if (header > 128) {
      const value = input[at] ?? 0
      at += 1
      const run = Math.min(257 - header, size - written)
      output.fill(value, written, written + run)
      written += run
    }
  }
  return output
}

function unpacked(compression: number, input: Uint8Array, size: number): Uint8Array | null {
  if (compression === 1) return input.length >= size ? input.subarray(0, size) : null
  if (compression === 5) return lzw(input, size)
  if (compression === 32773) return packBits(input, size)
  if (compression === 8 || compression === 32946)
    return input.length > 2 ? (inflate(input.subarray(2, -4), size) ?? null) : null
  return null
}

type Layout = {
  readonly width: number
  readonly height: number
  readonly samples: number
  readonly photometric: number
  readonly map: Field
  readonly extra: number
}

function painted(layout: Layout, plane: Uint8Array): Uint8Array {
  const { width, height, samples, photometric, map } = layout
  const rgba = new Uint8Array(width * height * 4)
  const third = map.length / 3
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const at = pixel * samples
    const first = plane[at] ?? 0
    const out = pixel * 4
    if (photometric === 2) {
      rgba[out] = first
      rgba[out + 1] = plane[at + 1] ?? 0
      rgba[out + 2] = plane[at + 2] ?? 0
    } else if (photometric === 3) {
      rgba[out] = (map[first] ?? 0) >> 8
      rgba[out + 1] = (map[first + third] ?? 0) >> 8
      rgba[out + 2] = (map[first + 2 * third] ?? 0) >> 8
    } else {
      const gray = photometric === 0 ? 255 - first : first
      rgba.fill(gray, out, out + 3)
    }
    const colored = photometric === 2 ? 3 : 1
    const alpha = samples > colored ? (plane[at + colored] ?? 255) : 255
    rgba[out + 3] = alpha
    if (layout.extra === 1 && alpha > 0 && alpha < 255)
      for (let channel = 0; channel < 3; channel += 1)
        rgba[out + channel] = Math.min(255, Math.round(((rgba[out + channel] ?? 0) * 255) / alpha))
  }
  return rgba
}

function predicted(block: Uint8Array, columns: number, samples: number): void {
  const row = columns * samples
  for (let start = 0; start + row <= block.length; start += row)
    for (let at = start + samples; at < start + row; at += 1)
      block[at] = ((block[at] ?? 0) + (block[at - samples] ?? 0)) & 255
}

export function tiffFile(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 8) return null
  const little = bytes[0] === 0x49 && bytes[1] === 0x49
  if (!little && !(bytes[0] === 0x4d && bytes[1] === 0x4d)) return null
  const tiff = { bytes, data: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), little }
  if (tiff.data.getUint16(2, little) !== 42) return null
  const found = fields(tiff)
  if (found === null) return null
  const one = (tag: number, absent: number) => found.get(tag)?.[0] ?? absent
  const width = one(tags.width, 0)
  const height = one(tags.height, 0)
  const samples = one(tags.samples, 1)
  const photometric = one(tags.photometric, 1)
  const compression = one(tags.compression, 1)
  const bits = found.get(tags.bits) ?? [1]
  if (width < 1 || height < 1 || width > largestSide || height > largestSide) return null
  if (bits.some((value) => value !== 8) || one(tags.planar, 1) !== 1 || samples < 1 || samples > 4) return null
  const tiled = found.has(tags.tileOffsets)
  const blockWidth = tiled ? one(tags.tileWidth, 0) : width
  const blockHeight = tiled ? one(tags.tileHeight, 0) : Math.min(height, one(tags.rowsPerStrip, height))
  const offsets = found.get(tiled ? tags.tileOffsets : tags.stripOffsets) ?? []
  const counts = found.get(tiled ? tags.tileBytes : tags.stripBytes) ?? []
  if (blockWidth < 1 || blockHeight < 1 || offsets.length === 0) return null
  const across = Math.ceil(width / blockWidth)
  const plane = new Uint8Array(width * height * samples)
  for (const [index, offset] of offsets.entries()) {
    const left = (index % across) * blockWidth
    const top = Math.floor(index / across) * blockHeight
    const rows = tiled ? blockHeight : Math.min(blockHeight, height - top)
    if (rows < 1) break
    const input = bytes.subarray(offset, offset + (counts[index] ?? 0))
    const block = unpacked(compression, input, blockWidth * rows * samples)
    if (block === null) return null
    if (one(tags.predictor, 1) === 2) predicted(block, blockWidth, samples)
    for (let row = 0; row < rows && top + row < height; row += 1) {
      const run = Math.min(blockWidth, width - left) * samples
      const from = row * blockWidth * samples
      plane.set(block.subarray(from, from + run), ((top + row) * width + left) * samples)
    }
  }
  const layout = { width, height, samples, photometric, map: found.get(tags.colorMap) ?? [], extra: one(tags.extra, 0) }
  return rgbaFile({ width, height }, painted(layout, plane))
}
